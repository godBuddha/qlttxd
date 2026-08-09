import { useState, useEffect } from 'react';
import { Loading } from '../components/Loading.jsx';
import { ConfigTable } from './settings-utils';

const FIELDS = [
  { key: 'global_max', label: 'Tổng số request tối đa', type: 'number', placeholder: '100' },
  { key: 'global_window_ms', label: 'Cửa sổ thời gian (ms)', type: 'number', placeholder: '60000' },
  { key: 'write_max', label: 'Write requests tối đa', type: 'number', placeholder: '20' },
  { key: 'auth_max', label: 'Auth requests tối đa', type: 'number', placeholder: '5' },
  { key: 'forgot_max', label: 'Forgot password tối đa', type: 'number', placeholder: '3' },
  { key: 'user_max', label: 'User actions tối đa', type: 'number', placeholder: '10' },
];

export function SettingsRateLimit({ api, notify }) {
  const [configs, setConfigs] = useState({});
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api('/api/v1/config?category=rate-limit')
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
      await api(`/api/v1/config/rate-limit/${editing.key}`, {
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

  if (loading) return <Loading />;

  function displayValue(field) {
    const raw = configs[field.key];
    if (raw === undefined || raw === null) return '—';
    return String(raw);
  }

  return (
    <>
      <div className="page-title">
        <div>
          <p className="eyebrow">Quản trị hệ thống</p>
          <h2>Cấu hình giới hạn tốc độ</h2>
        </div>
        <small style={{ color: 'var(--muted, #6c757d)' }}>
          Quy tắc giới hạn yêu cầu API
        </small>
      </div>
      <section className="panel">
        <ConfigTable
          title="Giới hạn tốc độ"
          fields={FIELDS}
          data={configs}
          editing={editing}
          editValue={editValue}
          setEditValue={setEditValue}
          onSave={save}
          onCancel={() => setEditing(null)}
          saving={saving}
          displayValue={displayValue}
          revealed={new Set()}
          onToggleReveal={() => {}}
          startEdit={startEdit}
        />
      </section>
    </>
  );
}
