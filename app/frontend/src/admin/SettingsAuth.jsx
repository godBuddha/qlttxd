import { useState, useEffect } from 'react';
import { request } from '../lib/api.js';
import { Loading } from '../components/Loading.jsx';
import { ConfigTable } from './settings-utils';

const FIELDS = [
  { key: 'jwt_access_ttl', label: 'JWT Access Token TTL', type: 'number', unit: 'ms', placeholder: '900000' },
  { key: 'jwt_refresh_ttl', label: 'JWT Refresh Token TTL', type: 'number', unit: 'ms', placeholder: '604800000' },
  { key: 'bcrypt_rounds', label: 'Bcrypt Rounds', type: 'number', placeholder: '12' },
  { key: 'reset_token_expiry_ms', label: 'Reset Token Expiry', type: 'number', unit: 'ms', placeholder: '3600000' },
  { key: 'cookie_max_age_ms', label: 'Cookie Max Age', type: 'number', unit: 'ms', placeholder: '86400000' },
  { key: 'cookie_same_site', label: 'Cookie SameSite', type: 'text', placeholder: 'strict' },
];

export function SettingsAuth({ api, notify }) {
  const [configs, setConfigs] = useState({});
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [revealed, setRevealed] = useState(new Set());

  useEffect(() => {
    let cancelled = false;
    api('/api/v1/config?category=auth')
      .then((data) => {
        if (!cancelled) {
          const map = {};
          (data || []).forEach((item) => { map[item.key] = item.value; });
          setConfigs(map);
        }
      })
      .catch((err) => { if (!cancelled) notify(err?.message || 'Lỗi tải cấu hình', 'error'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  function startEdit(field) {
    setEditing(field);
    setEditValue(configs[field.key] ?? '');
  }

  async function save() {
    if (!editing) return;
    setSaving(true);
    try {
      const val = editing.type === 'number' ? Number(editValue) : editValue;
      await api(`/api/v1/config/auth/${editing.key}`, {
        method: 'PUT',
        body: JSON.stringify({ value: val }),
      });
      setConfigs((prev) => ({ ...prev, [editing.key]: val }));
      setEditing(null);
      setEditValue('');
      notify('Đã cập nhật.', 'success');
    } catch (err) {
      notify(err?.message || 'Lỗi lưu cấu hình', 'error');
    } finally {
      setSaving(false);
    }
  }

  function toggleReveal(key) {
    setRevealed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  if (loading) return <Loading />;

  function displayValue(field) {
    const raw = configs[field.key];
    if (raw === undefined || raw === null) return '—';
    const str = String(raw);
    // Hide secret-ish values
    if (/secret|token|key/i.test(field.key) && !revealed.has(field.key)) {
      if (str.length > 4) return `${str.slice(0, 2)}${'*'.repeat(Math.min(str.length - 4, 20))}${str.slice(-2)}`;
      return '****';
    }
    return str;
  }

  return (
    <>
      <div className="page-title">
        <div>
          <p className="eyebrow">Quản trị hệ thống</p>
          <h2>Cấu hình xác thực</h2>
        </div>
        <small style={{ color: 'var(--muted, #6c757d)' }}>
          Cấu hình JWT, cookie và mật khẩu
        </small>
      </div>
      <section className="panel">
        <ConfigTable
          title="Xác thực"
          fields={FIELDS}
          data={configs}
          editing={editing}
          editValue={editValue}
          setEditValue={setEditValue}
          onSave={save}
          onCancel={() => setEditing(null)}
          saving={saving}
          displayValue={displayValue}
          revealed={revealed}
          onToggleReveal={toggleReveal}
          startEdit={startEdit}
        />
      </section>
    </>
  );
}
