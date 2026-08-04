import { lazy, Suspense, useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

import { request, can } from './lib/api.js';

import { Notice } from './components/Notice.jsx';
import { Loading } from './components/Loading.jsx';
import { Login } from './components/Login.jsx';
import { SetupAdminPage } from './components/SetupAdminPage.jsx';
import { BellNotification } from './components/BellNotification.jsx';

import { CitizenPage } from './pages/CitizenPage.jsx';
import { Dashboard } from './pages/Dashboard.jsx';
import { CaseList } from './pages/CaseList.jsx';
import { CaseDetail } from './pages/CaseDetail.jsx';
import { BanDoPage } from './pages/BanDoPage.jsx';
import { ReportPage } from './pages/ReportPage.jsx';
import { OfficerReportsPage } from './pages/OfficerReportsPage.jsx';
import { ProfilePage } from './pages/ProfilePage.jsx';

const AdminUsersPage = lazy(() => import('./admin/AdminUsersPage.jsx').then((m) => ({ default: m.AdminUsersPage })));
const AdminRolesPage = lazy(() => import('./admin/AdminRolesPage.jsx').then((m) => ({ default: m.AdminRolesPage })));
const AdminAuditLogPage = lazy(() => import('./admin/AdminAuditLogPage.jsx').then((m) => ({ default: m.AdminAuditLogPage })));
const AdminLocationsPage = lazy(() => import('./admin/AdminLocationsPage.jsx').then((m) => ({ default: m.AdminLocationsPage })));
const AdminCatalogPage = lazy(() => import('./admin/AdminCatalogPage.jsx').then((m) => ({ default: m.AdminCatalogPage })));

function App() {
  const [user, setUser] = useState(() => { try { return JSON.parse(localStorage.getItem('qlttxd_user')); } catch { return null; } }); const [route, setRoute] = useState(() => ({ page: 'home', id: null })); const [notice, setNotice] = useState(null); const [needsSetup, setNeedsSetup] = useState(null);
  const notify = (text, type = 'info') => setNotice({ text, type });
  // Register service worker for offline fallback
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);

  // Online/offline detection
  useEffect(() => {
    const goOffline = () => notify('Mất kết nối mạng. Một số tính năng có thể không hoạt động.', 'error');
    const goOnline = () => notify('Đã khôi phục kết nối mạng.', 'success');
    if (!navigator.onLine) goOffline();
    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);
    return () => { window.removeEventListener('offline', goOffline); window.removeEventListener('online', goOnline); };
  }, []);

  useEffect(() => {
    if (!user) {
      request('/api/v1/auth/setup-status').then((r) => setNeedsSetup(r.needsSetup)).catch(() => setNeedsSetup(false));
    }
  }, [user]);
  const logout = async () => { try { await request('/api/v1/auth/logout', { method: 'POST' }); } catch { /* local logout is still safe */ } localStorage.removeItem('qlttxd_token'); localStorage.removeItem('qlttxd_user'); setUser(null); setRoute({ page: 'home' }); notify('Đã đăng xuất.', 'success'); };
  const api = (path, opts) => request(path, opts, () => { localStorage.removeItem('qlttxd_token'); localStorage.removeItem('qlttxd_user'); setUser(null); notify('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.', 'error'); });
  if (!user) {
    if (needsSetup === null) return <Loading />;
    if (needsSetup) return <SetupAdminPage onSetup={(value) => { setUser(value); setRoute({ page: 'admin-users' }); }} />;
    return <Login onLogin={(value) => { setUser(value); setRoute({ page: can(value, 'case.view') ? 'dashboard' : 'citizen' }); }} notice={notice} />;
  }
  const nav = (page, id = null) => setRoute({ page, id }); const isOfficer = can(user, 'case.view');
  return <div className="app-shell"><header><div className="logo" onClick={() => nav(isOfficer ? 'dashboard' : 'citizen')} role="button" tabIndex="0">QLTTXD</div><div className="user-menu"><BellNotification api={api} /><span>{user.full_name || user.username}</span><small>{user.roles?.join(', ') || 'Người dùng'}</small><button className="logout" onClick={logout}>Đăng xuất</button></div></header><div className="body"><aside><nav>{!isOfficer && can(user, 'report.create') && <button className={route.page === 'citizen' ? 'selected' : ''} onClick={() => nav('citizen')}>⌖ Báo cáo vi phạm</button>}{isOfficer && <><button className={route.page === 'dashboard' ? 'selected' : ''} onClick={() => nav('dashboard')}>▦ Tổng quan</button><button className={route.page === 'cases' || route.page === 'case' ? 'selected' : ''} onClick={() => nav('cases')}>▤ Hồ sơ xử lý</button><button className={route.page === 'officer-reports' ? 'selected' : ''} onClick={() => nav('officer-reports')}>📝 Báo cáo vi phạm</button>{can(user, 'case.view') && <button className={route.page === 'ban-do' ? 'selected' : ''} onClick={() => nav('ban-do')}>🗺️ Bản đồ</button>}</>}{can(user, 'admin.users') && <><div className="nav-group">Quản trị</div><button className={route.page === 'admin-users' ? 'selected' : ''} onClick={() => nav('admin-users')}>👤 Người dùng</button><button className={route.page === 'admin-roles' ? 'selected' : ''} onClick={() => nav('admin-roles')}>🔑 Phân quyền</button><button className={route.page === 'admin-audit' ? 'selected' : ''} onClick={() => nav('admin-audit')}>📋 Nhật ký hệ thống</button></>}{can(user, 'admin.locations') && <button className={route.page === 'admin-locations' ? 'selected' : ''} onClick={() => nav('admin-locations')}>📍 Địa điểm</button>}{can(user, 'admin.users') && <button className={route.page === 'admin-catalog' ? 'selected' : ''} onClick={() => nav('admin-catalog')}>📚 Danh mục</button>}{can(user, 'report.statistics') && <button className={route.page === 'report' ? 'selected' : ''} onClick={() => nav('report')}>📊 Báo cáo</button>}<button className={route.page === 'profile' ? 'selected' : ''} onClick={() => nav('profile')}>👤 Hồ sơ</button><div className="permission">Quyền: {user.permissions?.join(', ') || '—'}</div></nav></aside><main className="content"><Notice notice={notice} onClose={() => setNotice(null)} />{route.page === 'citizen' && <CitizenPage api={api} notify={notify} />}{route.page === 'dashboard' && <Dashboard api={api} navigate={nav} notify={notify} />}{route.page === 'cases' && <CaseList api={api} navigate={nav} notify={notify} />}{route.page === 'case' && <CaseDetail id={route.id} api={api} user={user} navigate={nav} notify={notify} />}{route.page === 'admin-users' && <Suspense fallback={<Loading />}><AdminUsersPage api={api} notify={notify} /></Suspense>}{route.page === 'admin-roles' && <Suspense fallback={<Loading />}><AdminRolesPage api={api} notify={notify} /></Suspense>}{route.page === 'admin-locations' && <Suspense fallback={<Loading />}><AdminLocationsPage api={api} notify={notify} /></Suspense>}{route.page === 'admin-catalog' && <Suspense fallback={<Loading />}><AdminCatalogPage api={api} notify={notify} /></Suspense>}{route.page === 'admin-audit' && <Suspense fallback={<Loading />}><AdminAuditLogPage api={api} notify={notify} /></Suspense>}{route.page === 'report' && <ReportPage api={api} user={user} notify={notify} />}{route.page === 'officer-reports' && <OfficerReportsPage api={api} user={user} navigate={nav} notify={notify} />}{route.page === 'ban-do' && <BanDoPage api={api} notify={notify} />}{route.page === 'profile' && <ProfilePage api={api} user={user} notify={notify} />}</main></div></div>;
}
createRoot(document.getElementById('root')).render(<App />);
