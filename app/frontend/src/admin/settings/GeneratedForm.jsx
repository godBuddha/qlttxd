import { useEffect, useMemo, useState, useCallback, lazy, Suspense } from 'react';
import { request, can, errorText } from '../../lib/api.js';
import { Loading } from '../../components/Loading.jsx';
import { History } from 'lucide-react';
import { fieldEditPermission } from '../settings-manifests/index.js';

// Duration units and their canonical suffixes ("15m" / "2h" / "7d").
const DURATION_UNITS = [
  { value: 's', label: 'giây' },
  { value: 'm', label: 'phút' },
  { value: 'h', label: 'giờ' },
  { value: 'd', label: 'ngày' },
];

const UNIT_MS = { s: 1000, m: 60000, h: 3600000, d: 86400000 };

// Parse a duration string like "15m"/"2h"/"7d" into { amount, unit }.
function parseDuration(value) {
  const match = /^(\d+(?:\.\d+)?)\s*([smhd])$/.exec(String(value ?? '').trim());
  if (!match) return { amount: '', unit: 'm' };
  return { amount: match[1], unit: match[2] };
}

// Convert a duration string to milliseconds for min/max comparison.
function durationToMs(value) {
  const { amount, unit } = parseDuration(value);
  const n = Number(amount);
  if (!Number.isFinite(n)) return NaN;
  return n * UNIT_MS[unit];
}

// Pick the friendliest unit for a millisecond bound (used for defaults).
function suggestUnit(ms) {
  if (ms >= UNIT_MS.d) return 'd';
  if (ms >= UNIT_MS.h) return 'h';
  if (ms >= UNIT_MS.m) return 'm';
  return 's';
}

/** True when the field key refers to a secret-ish value. */
export function isSecretKey(key) {
  return /secret|password|credential/i.test(String(key || ''));
}

/**
 * Form auto-generated from one settings manifest.
 * Loads values with GET /api/v1/config?category=<cat> per distinct category,
 * saves changed fields atomically via PUT /api/v1/config/bulk.
 */
export function GeneratedForm({ manifest, api = request, user }) {
  // Distinct categories in field order — one fetch each.
  const categories = useMemo(
    () => [...new Set(manifest.fields.map((f) => f.key.split('.')[0]))],
    [manifest]
  );

  const [values, setValues] = useState(null); // { "category.key": raw }
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(null); // { type: 'success'|'error', text }
  const [historyField, setHistoryField] = useState(null); // field currently in drawer

  const load = useCallback(async () => {
    setError(null);
    setLoaded(false);
    try {
      const results = await Promise.all(
        categories.map((cat) =>
          api(`/api/v1/config?category=${encodeURIComponent(cat)}`)
            .then((rows) => ({ cat, rows: Array.isArray(rows?.data) ? rows.data : Array.isArray(rows) ? rows : [] }))
            .catch(() => ({ cat, rows: [] }))
        )
      );
      const next = {};
      for (const { cat, rows } of results) {
        for (const row of rows) next[`${cat}.${row.key}`] = row.value;
      }
      setValues(next);
      setLoaded(true);
    } catch (e) {
      setError(errorText(e));
      setLoaded(true);
    }
  }, [api, categories]);

  useEffect(() => {
    load();
  }, [load]);

  const [draft, setDraft] = useState({}); // unsaved edits keyed by full key

  const setValue = (field, value) => {
    setDraft((prev) => ({ ...prev, [field.key]: value }));
  };

  const resetDrafts = () => setDraft({});

  // Effective current value = draft edit or loaded DB value.
  const currentValue = (field) => {
    if (Object.prototype.hasOwnProperty.call(draft, field.key)) return draft[field.key];
    return values?.[field.key];
  };

  // A draft differs from the stored value → included in the save payload.
  const changedFields = useMemo(() => {
    if (!values) return [];
    return manifest.fields.filter((f) => {
      if (!Object.prototype.hasOwnProperty.call(draft, f.key)) return false;
      const dbVal = values[f.key];
      let newVal = draft[f.key];
      if (f.type === 'number') newVal = Number(newVal);
      if (f.type === 'boolean') newVal = Boolean(newVal);
      // Compare loosely on string form so JSON scalar shapes match.
      return String(newVal) !== String(dbVal);
    });
  }, [draft, values, manifest]);

  const dirty = changedFields.length > 0;

  const buildPayloadValue = (field, raw) => {
    if (field.type === 'number') return Number(raw);
    if (field.type === 'boolean') return Boolean(raw);
    return String(raw);
  };

  const save = async () => {
    if (!dirty || saving) return;
    setSaving(true);
    setStatus(null);
    try {
      await api('/api/v1/config/bulk', {
        method: 'PUT',
        body: JSON.stringify({
          items: changedFields.map((f) => ({
            category: f.key.split('.')[0],
            key: f.key.split('.').slice(1).join('.'),
            value: buildPayloadValue(f, draft[f.key]),
          })),
        }),
      });
      setDraft({});
      await load();
      setStatus({ type: 'success', text: 'Đã lưu thay đổi.' });
    } catch (e) {
      setStatus({ type: 'error', text: errorText(e) });
    } finally {
      setSaving(false);
    }
  };

  // Ctrl/Cmd+S saves; Escape reverts unsaved drafts.
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (dirty) save();
      } else if (e.key === 'Escape' && !historyField) {
        if (dirty) {
          resetDrafts();
          setStatus({ type: 'info', text: 'Đã hoàn tác các thay đổi chưa lưu.' });
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  if (error) {
    return (
      <div className="generated-form" data-testid="generated-form-error">
        <div className="notice error" role="alert">
          <span>{error}</span>
        </div>
        <button onClick={load}>Thử lại</button>
      </div>
    );
  }

  if (!loaded || values === null) {
    return (
      <div className="generated-form" aria-busy="true" data-testid="generated-form-loading">
        <div className="skeleton-block" />
        <div className="skeleton-block" />
        <div className="skeleton-block" />
      </div>
    );
  }

  const canEdit = manifest.editPermission
    ? can(user, manifest.editPermission)
    : true; // no permission declared → view-only gate handled by API anyway

  return (
    <form
      className="generated-form"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      {dirty && (
        <div className="unsaved-bar" role="status">
          <span>
            Có {changedFields.length} thay đổi chưa lưu. Ctrl+S để lưu, Esc để hoàn tác.
          </span>
        </div>
      )}
      {status && (
        <div
          className={`notice ${status.type === 'success' ? 'success' : status.type === 'error' ? 'error' : ''}`}
          role={status.type === 'error' ? 'alert' : 'status'}
          aria-live="polite"
        >
          <span>{status.text}</span>
        </div>
      )}
      {manifest.fields.map((field) => (
        <FieldRow
          key={field.key}
          field={field}
          value={currentValue(field)}
          changed={changedFields.some((f) => f.key === field.key)}
          disabled={!canEdit || !can(user, fieldEditPermission(manifest, field))}
          onChange={(v) => setValue(field, v)}
          onOpenHistory={() => setHistoryField(field)}
        />
      ))}
      {canEdit && (
        <div className="form-actions">
          <button type="submit" disabled={!dirty || saving}>
            {saving ? 'Đang lưu…' : 'Lưu thay đổi'}
          </button>
          {dirty && (
            <button type="button" className="text-button" onClick={resetDrafts}>
              Hoàn tác
            </button>
          )}
        </div>
      )}
      {!canEdit && (
        <p className="hint">Bạn chỉ có quyền xem cấu hình này.</p>
      )}

      {historyField && (
        <Suspense fallback={<Loading />}>
          <HistoryDrawerLazy
            field={historyField}
            api={api}
            onClose={() => setHistoryField(null)}
            onRolledBack={() => {
              setHistoryField(null);
              load();
              setStatus({ type: 'success', text: 'Đã hoàn tác về giá trị đã chọn.' });
            }}
          />
        </Suspense>
      )}
    </form>
  );
}

/* Drawer loaded lazily so it stays out of the initial bundle path. */
const HistoryDrawerLazy = lazy(() =>
  import('./HistoryDrawer.jsx').then((m) => ({ default: m.HistoryDrawer }))
);

/** One labelled row: control depends on the declared field type. */
function FieldRow({
  field,
  value,
  changed,
  disabled,
  onChange,
  onOpenHistory,
}) {
  const helpId = `help-${field.key.replace(/\./g, '-')}`;
  const secret = isSecretKey(field.key);
  const readonly = Boolean(field.readonly);

  // Warn text wins over plain help so the user sees the actionable message.
  const warn = warnText(field, value);
  const describedBy = field.help || warn ? helpId : undefined;

  return (
    <div
      className={`generated-field${changed ? ' field-changed' : ''}`}
      data-field-key={field.key}
      id={`field-${field.key.replace(/\./g, '-')}`}
    >
      <label htmlFor={`input-${helpId}`} className="generated-field-label">
        <strong>{field.label}</strong>
        <code className="state-code">{field.key}</code>
      </label>
      <div className="generated-field-control">
        {secret ? (
          <SecretInput id={`input-${helpId}`} value={value} disabled={disabled} onChange={onChange} />
        ) : field.type === 'duration' ? (
          <DurationInput
            id={`input-${helpId}`}
            field={field}
            value={value}
            disabled={disabled || readonly}
            onChange={onChange}
          />
        ) : field.type === 'boolean' ? (
          <ToggleSwitch
            id={`input-${helpId}`}
            label={field.label}
            checked={Boolean(value)}
            disabled={disabled || readonly}
            onChange={onChange}
          />
        ) : field.type === 'enum' ? (
          <select
            id={`input-${helpId}`}
            value={String(value ?? '')}
            disabled={disabled || readonly}
            onChange={(e) => onChange(e.target.value)}
            aria-describedby={describedBy}
          >
            {(field.options || []).map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        ) : (
          <input
            id={`input-${helpId}`}
            type={field.type === 'number' ? 'number' : 'text'}
            inputMode={field.type === 'number' ? 'numeric' : undefined}
            step={field.step ?? (field.type === 'number' ? 1 : undefined)}
            min={typeof field.min === 'number' ? field.min : undefined}
            max={typeof field.max === 'number' ? field.max : undefined}
            value={value == null ? '' : String(value)}
            disabled={disabled || readonly}
            readOnly={readonly}
            onChange={(e) =>
              onChange(field.type === 'number' ? e.target.value : e.target.value)
            }
            aria-describedby={describedBy}
          />
        )}
        <button
          type="button"
          className="text-button history-button"
          onClick={onOpenHistory}
          aria-label={`Lịch sử ${field.key}`}
          title="Xem lịch sử thay đổi"
        >
          <History size={16} aria-hidden="true" />
        </button>
      </div>
      {(field.help || warn) && (
        <small id={helpId} className={`generated-field-help${warn ? ' warning-inline' : ''}`}>
          {warn ? `⚠️ ${warn}` : field.help}
        </small>
      )}
    </div>
  );
}

function warnText(field, value) {
  if (field.warnBelow != null && Number(value) < field.warnBelow) return field.warnMessage;
  return null;
}

/** Secret fields show *** until revealed; reveal only shows what the API sent. */
function SecretInput({ id, value, disabled, onChange }) {
  const [shown, setShown] = useState(false);
  const display = shown ? String(value ?? '') : '';
  return (
    <div className="flex-row">
      <input
        id={id}
        type={shown ? 'text' : 'password'}
        value={display}
        placeholder={shown ? '' : '***'}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        autoComplete="off"
      />
      <button
        type="button"
        className="text-button"
        onClick={() => setShown((s) => !s)}
        aria-label={shown ? 'Ẩn giá trị' : 'Hiện giá trị'}
      >
        {shown ? 'Ẩn' : 'Hiện'}
      </button>
    </div>
  );
}

/** number input + unit select storing canonical "15m"/"2h"/"7d". */
function DurationInput({ id, field, value, disabled, onChange }) {
  const parsed = parseDuration(value);
  const minMs = field.min != null ? durationToMs(field.min) : NaN;
  const maxMs = field.max != null ? durationToMs(field.max) : NaN;
  const defaultUnit =
    Number.isFinite(maxMs) ? suggestUnit(maxMs) : Number.isFinite(minMs) ? suggestUnit(minMs) : 'm';
  const unit = parsed.unit || defaultUnit;

  const emit = (amount, u) => {
    if (amount === '') {
      onChange('');
      return;
    }
    onChange(`${Number(amount)}${u}`);
  };

  return (
    <div className="flex-row">
      <input
        id={id}
        type="number"
        min="0"
        value={parsed.amount}
        disabled={disabled}
        onChange={(e) => emit(e.target.value, unit)}
        aria-describedby={undefined}
      />
      <select
        aria-label="Đơn vị thời gian"
        value={unit}
        disabled={disabled}
        onChange={(e) => emit(parsed.amount, e.target.value)}
      >
        {DURATION_UNITS.map((u) => (
          <option key={u.value} value={u.value}>
            {u.label}
          </option>
        ))}
      </select>
    </div>
  );
}

/** Accessible switch button using the shared .toggle-switch styles. */
export function ToggleSwitch({ id, label, checked, disabled, onChange }) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      className="toggle-switch"
      aria-checked={checked ? 'true' : 'false'}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
    >
      <span className="toggle-thumb" aria-hidden="true" />
    </button>
  );
}
