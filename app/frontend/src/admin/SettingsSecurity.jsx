import { useState, useEffect } from 'react';
import { Loading } from '../components/Loading.jsx';
import { ConfigTable } from './settings-utils';

const FIELDS = [
  { key: 'request_timeout_ms', label: 'Yêu cầu timeout (ms)', type: 'number', placeholder: '30000' },
  { key: 'hsts_max_age', label: 'HSTS Max Age', type: 'number', placeholder: '31536000' },
  { key: 'cors_max_age', label: 'CORS Max Age', type: 'number', placeholder: '86400' },
  { key: 'forced_shutdown_ms', label: 'Buộc tắt máy (ms)', type: 'number', placeholder: '0' },
];

export function SettingsSecurity({ api, notify, navigate }) {
  const [configs, setConfigs] = useState({});
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api('/api/v1/config?category=security')
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
      await api(`/api/v1/config/security/${editing.key}`, {
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
          <h2>Cấu hình bảo mật</h2>
          {navigate && (
            <button className="back" onClick={() => navigate('admin-settings')}>
              ← Quay lại Cài đặt
            </button>
          )}
        </div>
        <p className="settings-subtitle">
          Quy tắc bảo mật và giới hạn thời gian
        </p>
      </div>
      <section className="panel">
        <ConfigTable
          title="Bảo mật"
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
