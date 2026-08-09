import { useState, useEffect } from 'react';
import { Loading } from '../components/Loading.jsx';
import { ConfigTable } from './settings-utils';

const FIELDS = [
  { key: 'HOME_LATITUDE', label: 'Vĩ độ bản đồ', type: 'number', placeholder: '21.0285' },
  { key: 'HOME_LONGITUDE', label: 'Kinh độ bản đồ', type: 'number', placeholder: '105.8542' },
  { key: 'THEME', label: 'Giao diện', type: 'text', placeholder: 'light' },
  { key: 'LANGUAGE', label: 'Ngôn ngữ', type: 'text', placeholder: 'vi' },
];

export function SettingsUI({ api, notify }) {
  const [configs, setConfigs] = useState({});
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api('/api/v1/config?category=appearance')
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
      await api(`/api/v1/config/appearance/${editing.key}`, {
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
          <h2>Cấu hình giao diện</h2>
        </div>
        <p className="settings-subtitle">
          Vĩ trí trung tâm, chủ đề và ngôn ngữ hiển thị
        </p>
      </div>
      <section className="panel">
        <ConfigTable
          title="Thiết lập giao diện"
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
