import React from 'react';

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
}) {
  return (
    <div className="table-wrap">
      <table>
        <caption>{title}</caption>
        <thead>
          <tr>
            <th>Tên tham số</th>
            <th>Giá trị hiện tại</th>
            <th className="table-cell-action-header">Chỉnh sửa</th>
          </tr>
        </thead>
        <tbody>
          {fields.map((field) => {
            const isEditing = editing?.key === field.key;
            const raw = data[field.key];
            const valStr = displayValue ? displayValue(field) : String(raw ?? '—');
            const isSecret = /secret|token|key/i.test(field.key);

            return (
              <tr key={field.key}>
                {/* Key + Label */}
                <td>
                  <strong>{field.label}</strong>
                  <br />
                  <code className="state-code">{field.key}</code>
                  {field.note && (
                    <small className="warning-inline">
                      ⚠️ {field.note}
                    </small>
                  )}
                </td>
                {/* Value cell */}
                <td>
                  {isEditing ? (
                    <input
                      autoFocus
                      type={field.type === 'number' ? 'number' : 'text'}
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      placeholder={field.placeholder}
                      readOnly={field.readonly}
                      aria-label={`Giá trị mới cho ${field.label}`}
                    />
                  ) : (
                    <span className="value-mono">
                      {valStr || '—'}
                    </span>
                  )}
                </td>
                {/* Actions cell */}
                <td className="config-actions">
                  {isEditing ? (
                    <>
                      <button
                        onClick={onSave}
                        disabled={saving}
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
    </div>
  );
}
