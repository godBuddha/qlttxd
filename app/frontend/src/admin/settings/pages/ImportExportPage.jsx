import { useEffect, useState } from 'react';
import { request, can, errorText, dateText } from '../../../lib/api.js';
import { useAuth } from '../../../lib/AuthContext.jsx';
import { Loading } from '../../../components/Loading.jsx';

/**
 * ImportExportPage — custom page của Settings Shell v2 (nhóm "system").
 * - Export: tải toàn bộ cấu hình JSON (GET /api/v1/config/export).
 * - Import: upload JSON → dryRun=true xem diff → xác nhận mới ghi dryRun=false.
 * - Lịch sử: GET /api/v1/config/history (cần category + key) + hoàn tác
 *   qua POST /api/v1/config/rollback/:historyId.
 */

function downloadJson(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(a.href);
}

export function ImportExportPage() {
  const { user } = useAuth();
  const canImport = can(user, 'config.edit.general');
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  // Export
  const [exporting, setExporting] = useState(false);

  // Import
  const [parsedItems, setParsedItems] = useState(null); // items từ file
  const [diff, setDiff] = useState(null); // kết quả dryRun=true
  const [confirming, setConfirming] = useState(false);
  const [importResult, setImportResult] = useState(null);

  // History
  const [histCategory, setHistCategory] = useState('');
  const [histKey, setHistKey] = useState('');
  const [history, setHistory] = useState(null);
  const [histError, setHistError] = useState(null);
  const [rollingBack, setRollingBack] = useState(null);

  async function handleExport() {
    setError(null);
    setNotice(null);
    setExporting(true);
    try {
      const res = await request('/api/v1/config/export');
      const rows = Array.isArray(res?.data) ? res.data : [];
      // Mask secret ở phía client nữa để an toàn khi lưu file.
      const masked = rows.map((r) => (r.is_secret ? { ...r, value: '***' } : r));
      downloadJson(masked, `qlttxd-config-export-${new Date().toISOString().slice(0, 10)}.json`);
      setNotice(`Đã xuất ${masked.length} cấu hình (giá trị bí mật được che).`);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setExporting(false);
    }
  }

  async function handleFileChange(e) {
    setError(null);
    setNotice(null);
    setDiff(null);
    setImportResult(null);
    setParsedItems(null);
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      let items = Array.isArray(json) ? json : json.items;
      if (!Array.isArray(items)) throw new Error('Tệp phải là mảng cấu hình hoặc có trường "items".');
      setParsedItems(items);
      await preview(items);
    } catch (err) {
      setError(`Không đọc được tệp: ${errorText(err)}`);
    } finally {
      e.target.value = '';
    }
  }

  /** Gọi dryRun=true — chỉ phân tích, KHÔNG ghi dữ liệu. */
  async function preview(items) {
    setError(null);
    setNotice(null);
    try {
      const res = await request('/api/v1/config/import?dry_run=true', {
        method: 'POST',
        body: JSON.stringify({ items }),
      });
      setDiff(res?.data || { would_update: [], invalid: [], unchanged: [] });
    } catch (e) {
      setDiff(null);
      setError(errorText(e));
    }
  }

  /** Chỉ chạy sau khi người dùng bấm "Xác nhận nhập" — dryRun=false. */
  async function handleConfirmImport() {
    if (!parsedItems || !canImport || confirming) return;
    setConfirming(true);
    setError(null);
    try {
      const res = await request('/api/v1/config/import?dry_run=false', {
        method: 'POST',
        body: JSON.stringify({ items: parsedItems }),
      });
      setImportResult(res?.data || null);
      setDiff(null);
      setNotice('Đã nhập cấu hình thành công.');
    } catch (e) {
      setError(errorText(e));
    } finally {
      setConfirming(false);
    }
  }

  async function loadHistory(e) {
    e?.preventDefault();
    setHistError(null);
    setHistory(null);
    if (!histCategory.trim() || !histKey.trim()) {
      setHistError('Cần nhập cả category và key để tra lịch sử.');
      return;
    }
    try {
      const res = await request(
        `/api/v1/config/history?category=${encodeURIComponent(histCategory.trim())}&key=${encodeURIComponent(histKey.trim())}&limit=50`
      );
      setHistory(Array.isArray(res?.data) ? res.data : []);
    } catch (err) {
      setHistError(errorText(err));
    }
  }

  async function handleRollback(row) {
    if (!canImport || rollingBack) return;
    if (!window.confirm('Hoàn tác cấu hình này về giá trị được chọn?')) return;
    setRollingBack(row.id);
    setHistError(null);
    try {
      await request(`/api/v1/config/rollback/${row.id}`, { method: 'POST' });
      setNotice('Đã hoàn tác cấu hình.');
      await loadHistory();
    } catch (e) {
      setHistError(errorText(e));
    } finally {
      setRollingBack(null);
    }
  }

  return (
    <>
      <p className="settings-subtitle">
        Xuất, nhập cấu hình hệ thống và tra cứu lịch sử thay đổi.
        {!canImport ? ' Bạn chỉ có quyền xem.' : ''}
      </p>

      <div aria-live="polite">
        {notice ? (
          <div className="notice" role="status"><span>{notice}</span></div>
        ) : null}
        {error ? (
          <div className="notice error" role="alert"><span>{error}</span></div>
        ) : null}
      </div>

      {/* Export */}
      <section className="panel" aria-labelledby="ie-export-h">
        <h3 id="ie-export-h">Xuất cấu hình</h3>
        <p className="hint">Tải toàn bộ cấu hình dạng JSON. Giá trị bí mật luôn được che (***).</p>
        <button type="button" onClick={handleExport} disabled={exporting}>
          {exporting ? 'Đang xuất…' : 'Tải xuống JSON'}
        </button>
      </section>

      {/* Import */}
      <section className="panel" aria-labelledby="ie-import-h">
        <h3 id="ie-import-h">Nhập cấu hình</h3>
        <label htmlFor="ie-import-file">Chọn tệp JSON cần nhập</label>
        <input
          id="ie-import-file"
          type="file"
          accept="application/json,.json"
          onChange={handleFileChange}
          disabled={!canImport}
        />
        {!canImport && <p className="hint">Bạn không có quyền nhập cấu hình.</p>}

        {diff && (
          <div className="table-wrap" role="region" aria-label="Xem trước thay đổi khi nhập">
            <table>
              <caption>Xem trước (chưa ghi vào hệ thống)</caption>
              <thead>
                <tr>
                  <th scope="col">Category</th>
                  <th scope="col">Key</th>
                  <th scope="col">Kết quả</th>
                  <th scope="col">Chi tiết</th>
                </tr>
              </thead>
              <tbody>
                {(diff.would_update || []).map((r) => (
                  <tr key={`u-${r.category}.${r.key}`}>
                    <td>{r.category}</td>
                    <td><code>{r.key}</code></td>
                    <td>Sửa</td>
                    <td>
                      <span title={JSON.stringify(r.old_value)}>hiện tại</span>
                      {' → '}
                      <span title={JSON.stringify(r.new_value)}>mới</span>
                    </td>
                  </tr>
                ))}
                {(diff.unchanged || []).map((r) => (
                  <tr key={`k-${r.category}.${r.key}`}>
                    <td>{r.category}</td>
                    <td><code>{r.key}</code></td>
                    <td>Giữ nguyên</td>
                    <td>—</td>
                  </tr>
                ))}
                {(diff.invalid || []).map((r, i) => (
                  <tr key={`e-${i}-${r.category}.${r.key}`}>
                    <td>{r.category ?? '—'}</td>
                    <td><code>{r.key ?? '—'}</code></td>
                    <td>Lỗi</td>
                    <td>{r.error}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {diff && (
          <button
            type="button"
            className="primary-button"
            onClick={handleConfirmImport}
            disabled={!canImport || confirming}
          >
            {confirming ? 'Đang nhập…' : 'Xác nhận nhập'}
          </button>
        )}
        {importResult && (
          <p className="hint">
            Đã cập nhật {importResult.imported ?? 0}, bỏ qua {importResult.skipped ?? 0}, giữ nguyên{' '}
            {importResult.unchanged ?? 0}.
          </p>
        )}
      </section>

      {/* History */}
      <section className="panel" aria-labelledby="ie-history-h">
        <h3 id="ie-history-h">Lịch sử thay đổi</h3>
        <form onSubmit={loadHistory} className="flex-row" aria-label="Lọc lịch sử thay đổi">
          <label htmlFor="ie-hist-cat">Nhóm</label>
          <input
            id="ie-hist-cat"
            type="text"
            value={histCategory}
            onChange={(e) => setHistCategory(e.target.value)}
            placeholder="vd: auth"
          />
          <label htmlFor="ie-hist-key">Khóa</label>
          <input
            id="ie-hist-key"
            type="text"
            value={histKey}
            onChange={(e) => setHistKey(e.target.value)}
            placeholder="vd: bcrypt_rounds"
          />
          <button type="submit">Tra cứu</button>
        </form>

        <div aria-live="polite">
          {histError ? (
            <div className="notice error" role="alert"><span>{histError}</span></div>
          ) : null}
        </div>

        {history !== null &&
          (history.length === 0 ? (
            <p className="empty">Chưa có thay đổi nào cho cấu hình này.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th scope="col">Thời gian</th>
                    <th scope="col">Người thực hiện</th>
                    <th scope="col">Hành động</th>
                    <th scope="col">Giá trị mới</th>
                    <th scope="col"></th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((row) => (
                    <tr key={row.id}>
                      <td><time dateTime={row.thoi_gian}>{dateText(row.thoi_gian)}</time></td>
                      <td>{row.full_name || row.username || 'Hệ thống'}</td>
                      <td>{row.action}</td>
                      <td><code>{typeof row.new_value === 'object' ? JSON.stringify(row.new_value) : String(row.new_value)}</code></td>
                      <td>
                        {canImport && (
                          <button
                            type="button"
                            className="text-button"
                            onClick={() => handleRollback(row)}
                            disabled={rollingBack === row.id}
                          >
                            {rollingBack === row.id ? 'Đang hoàn tác…' : 'Hoàn tác'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
      </section>
    </>
  );
}
