import { useState, useEffect } from 'react';
import { Loading } from '../components/Loading.jsx';
import { ConfigTable } from './settings-utils';

const FIELDS = [
  { key: 'worker_batch_size', label: 'Worker Batch Size', type: 'number', placeholder: '50' },
  { key: 'worker_poll_interval_ms', label: 'Worker Poll Interval (ms)', type: 'number', placeholder: '10000' },
  { key: 'heartbeat_ms', label: 'SSE Heartbeat (ms)', type: 'number', placeholder: '30000' },
  { key: 'poll_ms', label: 'SSE Poll Interval (ms)', type: 'number', placeholder: '5000' },
  { key: 'poll_limit', label: 'SSE Poll Limit', type: 'number', placeholder: '100' },
  { key: 'channels', label: 'Kênh thông báo', type: 'text', readonly: true, note: 'Chỉ xem — quản lý từ backend' },
];

export function SettingsNotification({ api, notify, navigate }) {
  const [configs, setConfigs] = useState({});
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api('/api/v1/config?category=notification')
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
    if (field.readonly) return;
    setEditing(field);
    setEditValue(configs[field.key] ?? '');
  }

  async function save() {
    if (!editing || editing.readonly) return;
    setSaving(true);
    try {
      const val = editing.type === 'number' ? Number(editValue) : editValue;
      await api(`/api/v1/config/notification/${editing.key}`, {
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
    if (Array.isArray(raw)) return raw.join(', ');
    return String(raw);
  }

  return (
    <>
      <div className="page-title">
        <div>
          <p className="eyebrow">Quản trị hệ thống</p>
          <h2>Cấu hình thông báo</h2>
          {navigate && (
            <button className="back" onClick={() => navigate('admin-settings')}>
              ← Quay lại Cài đặt
            </button>
          )}
        </div>
        <p className="settings-subtitle">
          Worker, SSE heartbeat và kênh thông báo
        </p>
      </div>
      <section className="panel">
        <ConfigTable
          title="Thông báo"
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
