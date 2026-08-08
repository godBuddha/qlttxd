import { useState, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight, ArrowLeft, File } from 'lucide-react';
import { API_BASE, can, errorText, dateText, money, downloadDocx } from '../lib/api.js';
import { STATE_LABELS, TRANSITIONS } from '../lib/constants.js';
import { Loading } from '../components/Loading.jsx';
import { Status } from '../components/Status.jsx';
import { MapView } from '../components/MapView.jsx';
import { EvidenceImage } from '../components/EvidenceImage.jsx';
import { Dialog } from '../components/Dialog.jsx';
import { Tabs, TabPanel } from '../components/Tabs.jsx';

export function CaseDetail({ id, api, user, navigate, notify }) {
  const [item, setItem] = useState(null);
  const [tab, setTab] = useState('overview');
  const [busy, setBusy] = useState(false);
  const [selectedState, setSelectedState] = useState('');
  const [statusHistory, setStatusHistory] = useState([]);
  const [transitionError, setTransitionError] = useState(null);
  const load = () =>
    api(`/api/v1/ho-so/${id}`)
      .then((r) => {
        setItem(r.data);
        setSelectedState(r.data.trang_thai);
      })
      .catch((e) => notify(errorText(e), 'error'));
  useEffect(() => {
    load();
  }, [id]);

  // Load status change history from audit log
  useEffect(() => {
    if (!id) return;
    api(`/api/v1/admin/audit-log?bang=ho_so&hanh_dong=case.status_change`)
      .then((r) => {
        const logs = (r.data || [])
          .filter((l) => String(l.id_ban_ghi) === String(id))
          .sort((a, b) => new Date(a.thoi_gian) - new Date(b.thoi_gian));
        setStatusHistory(logs);
      })
      .catch(() => setStatusHistory([]));
  }, [id]);

  // NOTE: this effect must be declared BEFORE the `if (!item)` early return so
  // the hook count stays constant across renders (Rules of Hooks). Guard on
  // item since it is null while the case is still loading.
  useEffect(() => {
    if (!item) return;
    const handler = (e) => {
      const tag = e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
        if (e.key === 'Escape') {
          setSelectedState(item.trang_thai);
          e.target.blur();
        }
        return;
      }
      if (
        e.key === 'Enter' &&
        can(user, 'case.update') &&
        selectedState &&
        selectedState !== item.trang_thai &&
        !busy
      ) {
        transition();
      } else if (e.key === 'Escape') {
        setSelectedState(item.trang_thai);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [item, selectedState, busy, user]);
  if (!item) return <Loading />;

  // Build visible transitions: allowed by workflow + role check
  const rawNextStates = TRANSITIONS[item.trang_thai] || [];
  const userRoles = (user?.roles || []);
  const visibleTransitions = rawNextStates.filter((next) => {
    // If user has admin role, allow everything
    if (userRoles.includes('admin')) return true;
    // Otherwise check role permissions via backend's canTransition logic
    // We replicate the same rule set here for client-side filtering
    const rolePermissions = {
      case_handler: new Set(['da_tiep_nhan', 'dang_khac_phuc', 'da_khac_phuc', 'da_dong', 'da_lap_bien_ban']),
      verifier: new Set(['dang_xac_minh', 'cho_bo_sung', 'cho_lap_bien_ban', 'da_dong']),
      leader: new Set(['cho_xac_minh', 'dang_xac_minh', 'cho_bo_sung', 'cho_lap_bien_ban', 'da_ra_quyet_dinh', 'da_dong', 'da_huy', 'da_chuyen_co_quan']),
    };
    for (const role of userRoles) {
      const perms = rolePermissions[role];
      if (perms && perms.has(next)) return true;
    }
    return false;
  });

  async function transition(targetState) {
    if (!targetState || targetState === item.trang_thai) return;
    setBusy(true);
    setTransitionError(null);
    try {
      await api(`/api/v1/ho-so/${id}/trang-thai`, {
        method: 'PATCH',
        body: JSON.stringify({ trang_thai: targetState }),
      });
      notify('Đã cập nhật trạng thái.', 'success');
      load();
    } catch (e) {
      const msg = errorText(e);
      setTransitionError(msg.includes('không hợp lệ') ? msg : `Không thực hiện được: ${msg}`);
      setSelectedState(item.trang_thai);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="page-title">
        <div>
          <button className="back" onClick={() => navigate('cases')}>
            <ArrowLeft size={20} aria-hidden="true"/> Danh sách hồ sơ
          </button>
          <h2>{item.ma_ho_so}</h2>
          <Status value={item.trang_thai} />
        </div>
      </div>
      <div className="detail-grid">
        <section className="panel">
          <h3>Thông tin hồ sơ</h3>
          <dl>
            <dt>Địa chỉ</dt>
            <dd>{item.dia_chi || '—'}</dd>
            <dt>Mô tả</dt>
            <dd>{item.mo_ta || item.bao_cao?.mo_ta || '—'}</dd>
            <dt>Thời gian xảy ra</dt>
            <dd>{dateText(item.thoi_gian_xay_ra)}</dd>
            <dt>Người vi phạm</dt>
            <dd>{item.nguoi_vi_pham?.ten || 'Chưa cập nhật'}</dd>
            <dt>Trạng thái</dt>
            <dd>
              <Status value={item.trang_thai} />
            </dd>
          </dl>
          {can(user, 'case.update') && (
            <div className="action-box">
              <label>Chuyển trạng thái</label>
              {visibleTransitions.length > 0 ? (
                <div className="transition-buttons">
                  {visibleTransitions.map((x) => (
                    <button
                      key={x}
                      type="button"
                      disabled={busy || x === item.trang_thai}
                      onClick={() => transition(x)}
                      title={STATE_LABELS[x] || x}
                      className="transition-btn"
                    >
                      {STATE_LABELS[x]}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="empty" style={{ textAlign: 'center', gridColumn: '1 / -1' }}>
                  Không có chuyển trạng thái nào khả dụng.
                </p>
              )}
              {transitionError && (
                <p className="field-error">{transitionError}</p>
              )}
              <small>Hệ thống chỉ chấp nhận các chuyển trạng thái hợp lệ theo vai trò.</small>
            </div>
          )}
        </section>
        <section className="panel">
          <h3>Vị trí GIS</h3>
          {item.toa_do ? (
            <MapView point={item.toa_do} height="350px" />
          ) : (
            <p className="empty">Hồ sơ chưa có tọa độ.</p>
          )}
        </section>
      </div>
      <section className="panel">
        <Tabs
          id="case-detail"
          label="Chi tiết hồ sơ"
          tabs={[
            ['overview', 'Timeline'],
            ['images', `Ảnh (${item.anh?.length || 0})`],
            ['minutes', 'Biên bản'],
            ['decision', 'Quyết định'],
            ['remedy', 'Khắc phục'],
          ].map(([key, label]) => ({ key, label }))}
          active={tab}
          onChange={setTab}
        />
        <TabPanel id="case-detail" tabKey="overview" active={tab === 'overview'}>
          <Timeline item={item} history={statusHistory} />
        </TabPanel>
        <TabPanel id="case-detail" tabKey="images" active={tab === 'images'}>
          <EvidenceGallery images={item.anh || []} />
        </TabPanel>
        <TabPanel id="case-detail" tabKey="minutes" active={tab === 'minutes'}>
          <Minutes
            caseItem={item}
            api={api}
            allow={can(user, 'bien_ban.create')}
            notify={notify}
            refresh={load}
          />
        </TabPanel>
        <TabPanel id="case-detail" tabKey="decision" active={tab === 'decision'}>
          <Decision
            caseItem={item}
            api={api}
            allow={can(user, 'quyet_dinh.issue')}
            notify={notify}
            refresh={load}
          />
        </TabPanel>
        <TabPanel id="case-detail" tabKey="remedy" active={tab === 'remedy'}>
          <Remedy
            caseItem={item}
            api={api}
            allow={can(user, 'khac_phuc.manage')}
            notify={notify}
            refresh={load}
          />
        </TabPanel>
      </section>
    </>
  );
}

export function EvidenceGallery({ images }) {
  const [lightbox, setLightbox] = useState(null); // index of the open image, or null
  const prev = (i) => setLightbox((i - 1 + images.length) % images.length);
  const next = (i) => setLightbox((i + 1) % images.length);
  if (!images.length)
    return (
      <div className="tab-body">
        <p className="empty">Chưa có ảnh minh chứng.</p>
      </div>
    );
  return (
    <div className="tab-body">
      <h3>Ảnh minh chứng</h3>
      <div className="evidence-gallery">
        {images.map((a, i) => (
          <button
            key={a.id}
            type="button"
            className="evidence-thumb"
            aria-label={`Xem ảnh phóng to: ${a.ten_goc}`}
            onClick={() => setLightbox(i)}
          >
            <EvidenceImage
              duongDan={a.duong_dan}
              alt={a.ten_goc}
              className="evidence-img"
              loading="lazy"
            />
          </button>
        ))}
      </div>
      {lightbox !== null && (
        <Dialog
          open
          className="lightbox-overlay"
          label={`Ảnh minh chứng: ${images[lightbox].ten_goc}`}
          onClose={() => setLightbox(null)}
          onOverlayClick={() => setLightbox(null)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowLeft') {
              e.preventDefault();
              prev(lightbox);
            } else if (e.key === 'ArrowRight') {
              e.preventDefault();
              next(lightbox);
            }
          }}
        >
          <button
            type="button"
            className="lightbox-close"
            aria-label="Đóng ảnh phóng to"
            onClick={() => setLightbox(null)}
          >
            <X size={20} aria-hidden="true"/>
          </button>
          <button
            type="button"
            className="lightbox-prev"
            aria-label="Ảnh trước"
            onClick={() => prev(lightbox)}
          >
            <ChevronLeft size={24} aria-hidden="true"/>
          </button>
          <EvidenceImage
            className="lightbox-img"
            duongDan={images[lightbox].duong_dan}
            alt={images[lightbox].ten_goc}
            onClick={(e) => e.stopPropagation()}
          />
          <button
            type="button"
            className="lightbox-next"
            aria-label="Ảnh sau"
            onClick={() => next(lightbox)}
          >
            <ChevronRight size={24} aria-hidden="true"/>
          </button>
          <div className="lightbox-caption">{images[lightbox].ten_goc}</div>
        </Dialog>
      )}
    </div>
  );
}

export function Timeline({ item, history }) {
  // Build timeline entries from audit log status changes + initial creation
  const entries = [];

  // Start: case creation
  if (item.created_at) {
    entries.push({
      state: null,
      label: 'Khởi tạo hồ sơ',
      timestamp: item.created_at,
      user: null,
      detail: {},
    });
  }

  // Insert status change events chronologically
  if (history && history.length > 0) {
    for (const log of history) {
      const detail = typeof log.chi_tiet === 'string' ? JSON.parse(log.chi_tiet) : log.chi_tiet;
      const fromLabel = detail.from ? STATE_LABELS[detail.from] || detail.from : '';
      const toLabel = detail.to ? STATE_LABELS[detail.to] || detail.to : '';
      entries.push({
        state: detail.to,
        label: `${fromLabel}${fromLabel ? ' → ' : ''}${toLabel}`,
        timestamp: log.thoi_gian,
        user: log.full_name || log.username || null,
        detail,
      });
    }
  }

  // Add current state if not already covered by last history entry
  // Only add fallback if we already have some timeline entries (otherwise leave it empty)
  const hasCurrentInHistory =
    history && history.length > 0
      ? (() => {
          const last = history[history.length - 1];
          const detail = typeof last.chi_tiet === 'string' ? JSON.parse(last.chi_tiet) : last.chi_tiet;
          return detail.to === item.trang_thai;
        })()
      : false;

  if (!hasCurrentInHistory && entries.length > 0) {
    entries.push({
      state: item.trang_thai,
      label: STATE_LABELS[item.trang_thai] || item.trang_thai,
      timestamp: item.updated_at,
      user: null,
      detail: {},
    });
  }

  return (
    <div>
      <h3>Tiến trình xử lý</h3>
      {entries.length === 0 ? (
        <p className="empty">Chưa có dữ liệu tiến trình.</p>
      ) : (
        <ol className="timeline">
          {entries.map((e, i) => {
            const isCurrent = e.state === item.trang_thai;
            const isTerminal = ['da_dong', 'da_huy', 'da_chuyen_co_quan'].includes(e.state);
            return (
              <li key={i} className={`${isCurrent ? 'current' : ''} ${isTerminal ? 'terminal' : ''}`}>
                <b>{e.label}</b>
                <span>
                  {dateText(e.timestamp)}
                  {e.user && <> · <em>{e.user}</em></>}
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

export function Minutes({ caseItem, api, allow, notify, refresh }) {
  const [noi_dung, setNoiDung] = useState('');
  const [muc_phat_du_kien, setFine] = useState('');
  async function submit(e) {
    e.preventDefault();
    try {
      await api(`/api/v1/ho-so/${caseItem.id}/bien-ban`, {
        method: 'POST',
        body: JSON.stringify({ noi_dung, muc_phat_du_kien: muc_phat_du_kien || null }),
      });
      notify('Đã lập biên bản.', 'success');
      refresh();
    } catch (x) {
      notify(errorText(x), 'error');
    }
  }
  return (
    <div className="tab-body">
      <h3>Biên bản</h3>
      {caseItem.bien_ban?.length ? (
        <ul className="record-list">
          {caseItem.bien_ban.map((x) => (
            <li key={x.id}>
              <b>{x.ma_bien_ban}</b>
              <span>
                {x.noi_dung || 'Không có nội dung'} — {money(x.muc_phat_du_kien)}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="empty">Chưa có biên bản.</p>
      )}
      {allow && (
        <form className="inline-form" onSubmit={submit}>
          <h4>Lập biên bản</h4>
          <label>
            Nội dung
            <textarea value={noi_dung} onChange={(e) => setNoiDung(e.target.value)} />
          </label>
          <label>
            Mức phạt dự kiến
            <input
              type="number"
              min="0"
              value={muc_phat_du_kien}
              onChange={(e) => setFine(e.target.value)}
            />
          </label>
          <button>Lập biên bản</button>
        </form>
      )}
      {caseItem.bien_ban?.length > 0 && (
        <div className="export-actions">
          <button
            onClick={() =>
              downloadDocx(
                API_BASE + '/api/v1/ho-so/' + caseItem.id + '/xuat-bien-ban.docx',
                'bien-ban-' + (caseItem.ma_ho_so || 'export') + '.docx',
                notify
              )
            }
          >
            <File size={16} aria-hidden="true"/> Xuất Word
          </button>
          <button
            onClick={() =>
              downloadDocx(
                API_BASE + '/api/v1/ho-so/' + caseItem.id + '/xuat-bien-ban.pdf',
                'bien-ban-' + (caseItem.ma_ho_so || 'export') + '.pdf',
                notify
              )
            }
          >
            <File size={16} aria-hidden="true"/> Xuất PDF
          </button>
        </div>
      )}
    </div>
  );
}

export function Decision({ caseItem, api, allow, notify, refresh }) {
  const [form, setForm] = useState({
    bien_ban_id: '',
    nhom_cong_trinh: '1',
    can_cu_phap_ly: '',
    hinh_thuc_phat_bo_sung: '',
    bien_phap_khac_phuc_hau_qua: '',
  });
  const [banBusy, setBanBusy] = useState(false);
  const set = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  async function submit(e) {
    e.preventDefault();
    try {
      await api(`/api/v1/ho-so/${caseItem.id}/quyet-dinh`, {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          bien_ban_id: form.bien_ban_id || null,
          nhom_cong_trinh: Number(form.nhom_cong_trinh),
        }),
      });
      notify('Đã tạo quyết định nháp.', 'success');
      refresh();
    } catch (x) {
      notify(errorText(x), 'error');
    }
  }
  async function banHanh(_qdId) {
    setBanBusy(true);
    try {
      await api(`/api/v1/ho-so/${caseItem.id}/quyet-dinh/ban-hanh`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      notify('Đã ban hành quyết định.', 'success');
      refresh();
    } catch (x) {
      notify(errorText(x), 'error');
    } finally {
      setBanBusy(false);
    }
  }
  return (
    <div className="tab-body">
      <h3>Quyết định xử phạt</h3>
      {caseItem.quyet_dinh?.length ? (
        <ul className="record-list">
          {caseItem.quyet_dinh.map((x) => (
            <li key={x.id}>
              <b>{x.ma_quyet_dinh}</b>
              <span>
                {money(x.so_tien_phat)} ·{' '}
                {x.trang_thai === 'draft' ? (
                  <span className="badge draft">Nháp</span>
                ) : (
                  <>
                    {dateText(x.ngay_ban_hanh)} ·{' '}
                    <span className="badge da_ra_quyet_dinh">Đã ban hành</span>
                  </>
                )}
              </span>
              {allow && x.trang_thai === 'draft' && (
                <button className="text-button" disabled={banBusy} onClick={() => banHanh(x.id)}>
                  {banBusy ? 'Đang ban hành…' : 'Ban hành'}
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="empty">Chưa có quyết định.</p>
      )}
      {allow && (
        <form className="inline-form form-grid" onSubmit={submit}>
          <h4 className="full">Tạo quyết định</h4>
          <label>
            Biên bản
            <select name="bien_ban_id" value={form.bien_ban_id} onChange={set}>
              <option value="">Không chọn</option>
              {(caseItem.bien_ban || []).map((x) => (
                <option key={x.id} value={x.id}>
                  {x.ma_bien_ban}
                </option>
              ))}
            </select>
          </label>
          <label>
            Nhóm công trình
            <input
              type="number"
              min="1"
              name="nhom_cong_trinh"
              value={form.nhom_cong_trinh}
              onChange={set}
            />
          </label>
          <label>
            Căn cứ pháp lý
            <input name="can_cu_phap_ly" value={form.can_cu_phap_ly} onChange={set} />
          </label>
          <label className="full">
            Hình thức phạt bổ sung
            <textarea
              name="hinh_thuc_phat_bo_sung"
              value={form.hinh_thuc_phat_bo_sung}
              onChange={set}
            />
          </label>
          <label className="full">
            Biện pháp khắc phục hậu quả
            <textarea
              name="bien_phap_khac_phuc_hau_qua"
              value={form.bien_phap_khac_phuc_hau_qua}
              onChange={set}
            />
          </label>
          <button className="full">Ban hành quyết định</button>
        </form>
      )}
      {caseItem.quyet_dinh?.length > 0 && (
        <div className="export-actions">
          <button
            onClick={() =>
              downloadDocx(
                API_BASE + '/api/v1/ho-so/' + caseItem.id + '/xuat-quyet-dinh.docx',
                'quyet-dinh-' + (caseItem.ma_ho_so || 'export') + '.docx',
                notify
              )
            }
          >
            <File size={16} aria-hidden="true"/> Xuất Word
          </button>
          <button
            onClick={() =>
              downloadDocx(
                API_BASE + '/api/v1/ho-so/' + caseItem.id + '/xuat-quyet-dinh.pdf',
                'quyet-dinh-' + (caseItem.ma_ho_so || 'export') + '.pdf',
                notify
              )
            }
          >
            <File size={16} aria-hidden="true"/> Xuất PDF
          </button>
        </div>
      )}
    </div>
  );
}

export function Remedy({ caseItem, api, allow, notify, refresh }) {
  const [form, setForm] = useState({
    quyet_dinh_id: '',
    bien_phap: '',
    mo_ta: '',
    han_thuc_hien: '',
  });
  const [remedy, setRemedy] = useState(null);
  const [status, setStatus] = useState('dang_thuc_hien');
  const set = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  async function submit(e) {
    e.preventDefault();
    try {
      const r = await api(`/api/v1/ho-so/${caseItem.id}/khac-phuc`, {
        method: 'POST',
        body: JSON.stringify({ ...form, quyet_dinh_id: form.quyet_dinh_id || null }),
      });
      setRemedy(r.data);
      notify('Đã đăng ký theo dõi khắc phục.', 'success');
      refresh();
    } catch (x) {
      notify(errorText(x), 'error');
    }
  }
  async function update() {
    try {
      const r = await api(`/api/v1/khac-phuc/${remedy.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ trang_thai: status }),
      });
      setRemedy(r.data);
      notify('Đã cập nhật trạng thái khắc phục.', 'success');
      refresh();
    } catch (x) {
      notify(errorText(x), 'error');
    }
  }
  return (
    <div className="tab-body">
      <h3>Khắc phục hậu quả</h3>
      <p className="hint">
        Sau khi đăng ký trong phiên hiện tại, có thể cập nhật trạng thái theo dõi. API chi tiết hồ
        sơ hiện chưa trả danh sách khắc phục đã có, nên cần chọn hồ sơ/tạo thông tin để thao tác
        tiếp.
      </p>
      {remedy && (
        <div className="action-box">
          <b>Thông tin khắc phục vừa tạo</b>
          <label>
            Trạng thái
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              {[
                'chua_thuc_hien',
                'dang_thuc_hien',
                'da_thuc_hien',
                'qua_han',
                'cuong_che',
                'da_kiem_tra',
              ].map((x) => (
                <option key={x} value={x}>
                  {x.replaceAll('_', ' ')}
                </option>
              ))}
            </select>
          </label>
          <button onClick={update}>Cập nhật trạng thái</button>
        </div>
      )}
      {allow && (
        <form className="inline-form form-grid" onSubmit={submit}>
          <label>
            Quyết định
            <select name="quyet_dinh_id" value={form.quyet_dinh_id} onChange={set}>
              <option value="">Không chọn</option>
              {(caseItem.quyet_dinh || []).map((x) => (
                <option key={x.id} value={x.id}>
                  {x.ma_quyet_dinh}
                </option>
              ))}
            </select>
          </label>
          <label>
            Hạn thực hiện
            <input type="date" name="han_thuc_hien" value={form.han_thuc_hien} onChange={set} />
          </label>
          <label className="full">
            Biện pháp *<textarea required name="bien_phap" value={form.bien_phap} onChange={set} />
          </label>
          <label className="full">
            Mô tả
            <textarea name="mo_ta" value={form.mo_ta} onChange={set} />
          </label>
          <button className="full">Đăng ký khắc phục</button>
        </form>
      )}
    </div>
  );
}
