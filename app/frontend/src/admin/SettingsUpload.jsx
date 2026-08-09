import { useState, useEffect } from 'react';
import { Loading } from '../components/Loading.jsx';
import { ConfigTable } from './settings-utils';

const FIELDS = [
  { key: 'max_mb', label: 'Kích thước tối đa (MB)', type: 'number', placeholder: '10' },
  { key: 'allowed_mime_types', label: 'Định dạng cho phép', type: 'text', readonly: true, note: 'Chỉ xem — chỉnh sửa từ backend' },
  { key: 'body_limit_json', label: 'Giới hạn body JSON', type: 'text', placeholder: '1mb' },
  { key: 'body_limit_urlencoded', label: 'Giới hạn URL-encoded', type: 'text', placeholder: '1kb' },
];

export function SettingsUpload({ api, notify, navigate }) {
  const [configs, setConfigs] = useState({});
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api('/api/v1/config?category=upload')
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
      await api(`/api/v1/config/upload/${editing.key}`, {
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
          <h2>Cấu hình tải lên</h2>
          {navigate && (
            <button className="back" onClick={() => navigate('admin-settings')}>
              ← Quay lại Cài đặt
            </button>
          )}
        </div>
        <p className="settings-subtitle">
          Kích thước và định dạng tệp tải lên
        </p>
      </div>
      <section className="panel">
        <ConfigTable
          title="Tải lên"
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
