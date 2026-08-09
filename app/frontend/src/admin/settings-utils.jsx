import { useState } from 'react';

/**
 * Shared config table — render fields as editable rows.
 * 
 * Props:
 *   title       – section label
 *   fields      – [{ key, label, type: 'text'|'number', placeholder, readonly?, note? }]
 *   data        – { [key]: value } lookup from API
 *   editing     – currently editing field or null
 *   editValue   – current input value
 *   setEditValue– setter
 *   onSave/onCancel – callbacks
 *   saving      – loading indicator
 *   displayValue(field) → string — custom rendering of non-editing cells
 *   revealed    – Set of secret keys shown in plain text
 *   onToggleReveal(key) – toggle reveal state
 */
export function ConfigTable({
  title,
  fields,
  data,
  editing,
  editValue,
  setEditValue,
  onSave,
  onCancel,
  saving,
  displayValue,
  revealed,
  onToggleReveal,
  startEdit,
}) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <caption style={{ textAlign: 'left', padding: '0 0 8px', fontWeight: 600 }}>{title}</caption>
      <thead>
        <tr style={{ borderBottom: '2px solid var(--border)' }}>
          <th style={{ ...thStyle, textAlign: 'left' }}>Tên tham số</th>
          <th style={{ ...thStyle, textAlign: 'left' }}>Giá trị hiện tại</th>
          <th style={{ ...thStyle, textAlign: 'center', width: 180 }}>Chỉnh sửa</th>
        </tr>
      </thead>
      <tbody>
        {fields.map((field) => {
          const isEditing = editing?.key === field.key;
          const raw = data[field.key];
          const valStr = displayValue ? displayValue(field) : String(raw ?? '—');
          const isSecret = /secret|token|key/i.test(field.key);

          return (
            <tr key={field.key} style={{ borderBottom: '1px solid var(--border)' }}>
              {/* Key + Label */}
              <td style={tdStyle}>
                <strong>{field.label}</strong>
                <br />
                <code style={{ fontSize: 12, color: 'var(--muted, #6c757d)' }}>
                  {field.key}
                </code>
                {field.note && (
                  <small style={{ display: 'block', marginTop: 4, color: '#dc2626' }}>
                    ⚠️ {field.note}
                  </small>
                )}
              </td>
              {/* Value cell */}
              <td style={tdStyle}>
                {isEditing ? (
                  <input
                    autoFocus
                    type={field.type === 'number' ? 'number' : 'text'}
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    style={{ ...inputStyle, width: '100%' }}
                    placeholder={field.placeholder}
                    readOnly={field.readonly}
                    aria-label={`Giá trị mới cho ${field.label}`}
                  />
                ) : (
                  <span style={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>
                    {valStr || '—'}
                  </span>
                )}
              </td>
              {/* Actions cell */}
              <td style={{ ...tdStyle, textAlign: 'center' }}>
                {isEditing ? (
                  <>
                    <button
                      onClick={onSave}
                      disabled={saving}
                      style={{ ...btnStyle, marginRight: 8 }}
                    >
                      {saving ? 'Đang lưu...' : 'Lưu'}
                    </button>
                    <button
                      onClick={onCancel}
                      disabled={saving}
                      className="text-button"
                    >
                      Hủy
                    </button>
                  </>
                ) : (
                  <>
                    {!field.readonly && (
                      <button
                        className="text-button"
                        onClick={() => onSave !== undefined ? {} : null}
                        style={{ fontSize: 13 }}
                        // Note: actual startEdit is called by parent before setting `editing`
                        aria-label={`Sửa ${field.label}`}
                      >
                        Sửa
                      </button>
                    )}
                    {isSecret && !revealed.has(field.key) && (
                      <button
                        className="text-button"
                        onClick={() => onToggleReveal(field.key)}
                        style={{ fontSize: 13, marginLeft: 8 }}
                        aria-label={`Hiện giá trị ${field.label}`}
                      >
                        👁️
                      </button>
                    )}
                  </>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

const thStyle = {
  padding: '8px 12px',
  fontSize: 13,
  fontWeight: 600,
  color: 'var(--muted, #6c757d)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
};

const tdStyle = {
  padding: '10px 12px',
  verticalAlign: 'middle',
};

const inputStyle = {
  padding: '6px 10px',
  border: '1px solid var(--border)',
  borderRadius: 4,
  fontSize: 14,
  outline: 'none',
};

const btnStyle = {
  padding: '6px 14px',
  background: '#1a56db',
  color: '#fff',
  border: 'none',
  borderRadius: 4,
  cursor: 'pointer',
  fontSize: 13,
  fontWeight: 500,
};
