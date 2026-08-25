import { useEffect, useMemo, useState } from 'react';
import { request, can, errorText } from '../../../lib/api.js';
import { useAuth } from '../../../lib/AuthContext.jsx';
import { Loading } from '../../../components/Loading.jsx';

// Nhãn hiển thị fallback khi backend không trả label cho transition.
function transLabel(t) {
  return t.label || `${t.from_state} → ${t.to_state}`;
}

/**
 * WorkflowTransitionsPage — custom page của Settings Shell v2 (nhóm "workflow").
 * Ma trận chuyển trạng thái: hàng = from_state, cột = to_state.
 * Ô hợp lệ click bật/tắt → hộp xác nhận → PUT /api/v1/config/workflow/transitions/:id.
 * Ô không tồn tại: disabled + tooltip. Hàng trạng thái kết thúc (terminal): tô xám.
 */
export function WorkflowTransitionsPage() {
  const { user } = useAuth();
  const [transitions, setTransitions] = useState(null);
  const [states, setStates] = useState([]);
  const [error, setError] = useState(null);
  // Pending toggle chờ xác nhận: { id, row, col, enable }
  const [pending, setPending] = useState(null);
  const [saving, setSaving] = useState(false);

  const canEdit = can(user, 'config.edit.workflow');

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      request('/api/v1/config/workflow/transitions'),
      request('/api/v1/config/workflow/states').catch(() => null),
    ])
      .then(([tRes, sRes]) => {
        if (cancelled) return;
        setTransitions(Array.isArray(tRes?.data) ? tRes.data : []);
        setStates(Array.isArray(sRes?.data) ? sRes.data : []);
      })
      .catch((e) => {
        if (!cancelled) setError(errorText(e));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Ma trận: hàng = from_state, cột = to_state; map tra cứu nhanh theo cặp state.
  const { rows, cols, byPair } = useMemo(() => {
    const list = transitions || [];
    const fromSet = new Set(list.map((t) => t.from_state));
    const toSet = new Set(list.map((t) => t.to_state));
    // Bổ sung state từ bảng states để hàng terminal (không có outgoing) vẫn hiện.
    for (const s of states) {
      fromSet.add(s.code);
      toSet.add(s.code);
    }
    const sorted = (set) => [...set].sort((a, b) => a.localeCompare(b, 'vi'));
    const pairMap = new Map();
    for (const t of list) pairMap.set(`${t.from_state}\u0000${t.to_state}`, t);
    return { rows: sorted(fromSet), cols: sorted(toSet), byPair: pairMap };
  }, [transitions, states]);

  const isTerminalRow = (rowCode) => {
    const s = states.find((x) => x.code === rowCode);
    if (s && s.is_terminal) return true;
    // Fallback: hàng không có ô hợp lệ nào coi như terminal.
    return !rows.some((c) => byPair.has(`${rowCode}\u0000${c}`));
  };

  function requestToggle(t) {
    if (!canEdit || saving || !t) return;
    setPending({ id: t.id, row: t.from_state, col: t.to_state, remove: true });
  }

  async function confirmSave() {
    if (!pending) return;
    setSaving(true);
    try {
      await request(`/api/v1/config/workflow/transitions/${pending.id}`, {
        method: 'PUT',
        body: JSON.stringify({ sort_order: -1 }),
      });
      setPending(null);
    } catch (e) {
      setError(errorText(e));
      setPending(null);
    } finally {
      setSaving(false);
    }
  }

  if (error) {
    return (
      <div className="notice error" role="alert">
        <span>Lỗi tải ma trận chuyển trạng thái: {error}</span>
      </div>
    );
  }
  if (transitions === null) return <Loading />;

  return (
    <>
      <p className="settings-subtitle">
        Ma trận chuyển trạng thái: hàng là trạng thái nguồn, cột là trạng thái đích
        {canEdit ? ' — nhấp vào ô để bật/tắt.' : ' (chỉ xem).'}
      </p>

      <section className={`panel${'' /* terminal rows are grayed via class on tr */}`} aria-labelledby="wf-trans-h">
        <h3 id="wf-trans-h">Chuyển trạng thái</h3>
        {rows.length === 0 ? (
          <p className="empty">Chưa có chuyển trạng thái nào được cấu hình.</p>
        ) : (
          <div className="table-wrap">
            <table className="wf-transition-matrix">
              <thead>
                <tr>
                  <th scope="col">Từ \ Đến</th>
                  {cols.map((c) => (
                    <th key={c} scope="col" className="table-cell-center">
                      <code className="state-code">{c}</code>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const terminal = isTerminalRow(r);
                  return (
                    <tr key={r} className={terminal ? 'wf-row-terminal' : undefined}>
                      <th scope="row">
                        <code className="state-code primary">{r}</code>
                      </th>
                      {cols.map((c) => {
                        const t = byPair.get(`${r}\u0000${c}`);
                        if (!t) {
                          return (
                            <td key={`${r}->${c}`} className="table-cell-center">
                              <button
                                type="button"
                                className="cell-toggle disabled"
                                disabled
                                title="Không có đường chuyển trạng thái này"
                                aria-label={`${r} → ${c}: không khả dụng`}
                              >
                                –
                              </button>
                            </td>
                          );
                        }
                        return (
                          <td key={`${r}->${c}`} className="table-cell-center">
                            <button
                              type="button"
                              className={`cell-toggle${t.sort_order >= 0 ? ' enabled' : ''}`}
                              onClick={() => requestToggle(t)}
                              disabled={!canEdit || saving}
                              title={transLabel(t)}
                              aria-label={`${r} → ${c}: ${t.sort_order >= 0 ? 'đang bật' : 'đang tắt'}${canEdit ? ', nhấp để đổi' : ''}`}
                              aria-pressed={t.sort_order >= 0}
                            >
                              {t.sort_order >= 0 ? '✓' : ''}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Hộp xác nhận trước khi lưu */}
      {pending && (
        <div
          className="modal-backdrop"
          role="presentation"
          onKeyDown={(e) => {
            if (e.key === 'Escape' && !saving) setPending(null);
          }}
        >
          <div
            className="panel confirm-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="wf-trans-confirm-h"
          >
            <h4 id="wf-trans-confirm-h">Xác nhận thay đổi</h4>
            <p>
              Đổi này ảnh hưởng hồ sơ đang mở ({pending.row} → {pending.col}).
              Bạn chắc chắn muốn tiếp tục?
            </p>
            <div className="flex-row">
              <button type="button" onClick={confirmSave} disabled={saving}>
                {saving ? 'Đang lưu…' : 'Xác nhận'}
              </button>
              <button
                type="button"
                className="text-button"
                onClick={() => setPending(null)}
                disabled={saving}
              >
                Hủy
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
