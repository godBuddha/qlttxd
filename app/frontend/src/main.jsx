import { lazy, Suspense, useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

import { request, can } from './lib/api.js';
import { AuthProvider, useAuth } from './lib/AuthContext.jsx';
import { ConfigProvider } from './lib/ConfigContext.jsx';

import { Notice } from './components/Notice.jsx';
import { ErrorBoundary } from './components/ErrorBoundary.jsx';
import { NotFound } from './components/NotFound.jsx';
import { Loading } from './components/Loading.jsx';
import { Login } from './components/Login.jsx';
import { SetupAdminPage } from './components/SetupAdminPage.jsx';
import { BellNotification } from './components/BellNotification.jsx';

import { CitizenPage } from './pages/CitizenPage.jsx';
import { Dashboard } from './pages/Dashboard.jsx';
import { CaseList } from './pages/CaseList.jsx';
import { ProfilePage } from './pages/ProfilePage.jsx';

const CaseDetail = lazy(() =>
  import('./pages/CaseDetail.jsx').then((m) => ({ default: m.CaseDetail }))
);
const BanDoPage = lazy(() =>
  import('./pages/BanDoPage.jsx').then((m) => ({ default: m.BanDoPage }))
);
const ReportPage = lazy(() =>
  import('./pages/ReportPage.jsx').then((m) => ({ default: m.ReportPage }))
);
const OfficerReportsPage = lazy(() =>
  import('./pages/OfficerReportsPage.jsx').then((m) => ({ default: m.OfficerReportsPage }))
);

const AdminUsersPage = lazy(() =>
  import('./admin/AdminUsersPage.jsx').then((m) => ({ default: m.AdminUsersPage }))
);
const AdminRolesPage = lazy(() =>
  import('./admin/AdminRolesPage.jsx').then((m) => ({ default: m.AdminRolesPage }))
);
const AdminAuditLogPage = lazy(() =>
  import('./admin/AdminAuditLogPage.jsx').then((m) => ({ default: m.AdminAuditLogPage }))
);
const AdminLocationsPage = lazy(() =>
  import('./admin/AdminLocationsPage.jsx').then((m) => ({ default: m.AdminLocationsPage }))
);
const AdminCatalogPage = lazy(() =>
  import('./admin/AdminCatalogPage.jsx').then((m) => ({ default: m.AdminCatalogPage }))
);

// Icon library for accessible, font-independent navigation icons
import {
  AlertCircle,
  BarChart3,
  BookOpen,
  Building2,
  FolderOpen,
  Key,
  LayoutDashboard,
  Map,
  NotebookText,
  ScrollText,
  User,
  Users,
} from 'lucide-react';

function getPath(page, id) {
  const paths = {
    home: '/',
    dashboard: '/dashboard',
    cases: '/cases',
    case: `/cases/${id}`,
    citizen: '/citizen',
    'admin-users': '/admin/users',
    'admin-roles': '/admin/roles',
    'admin-audit': '/admin/audit-log',
    'admin-locations': '/admin/locations',
    'admin-catalog': '/admin/catalog',
    report: '/report',
    profile: '/profile',
    'officer-reports': '/officer-reports',
    'ban-do': '/ban-do',
  };
  return paths[page] || '/';
}

function getPageFromPath(path) {
  if (path === '/' || path === '') return { page: 'home', id: null };
  const caseMatch = path.match(/^\/cases\/([^/]+)/);
  if (caseMatch) return { page: 'case', id: decodeURIComponent(caseMatch[1]) };
  const map = {
    '/dashboard': 'dashboard',
    '/cases': 'cases',
    '/citizen': 'citizen',
    '/admin/users': 'admin-users',
    '/admin/roles': 'admin-roles',
    '/admin/audit-log': 'admin-audit',
    '/admin/locations': 'admin-locations',
    '/admin/catalog': 'admin-catalog',
    '/report': 'report',
    '/profile': 'profile',
    '/officer-reports': 'officer-reports',
    '/ban-do': 'ban-do',
  };
  return { page: map[path] || 'unknown', id: null };
}

function App() {
  const { user, login, logout } = useAuth();
  const [route, setRoute] = useState(() => getPageFromPath(window.location.pathname));
  const [notice, setNotice] = useState(null);
  const [needsSetup, setNeedsSetup] = useState(null);
  const mainRef = useRef(null);
  const notify = (text, type = 'info') => setNotice({ text, type });

  // Central navigation: update state AND push browser history so Back/Forward,
  // refresh and deep-links resolve to the current page.
  const nav = (page, id = null) => {
    const path = getPath(page, id);
    if (window.location.pathname !== path) {
      window.history.pushState({ page, id }, '', path);
    }
    setRoute({ page, id });
  };

  // Browser Back/Forward: restore route from the current pathname
  useEffect(() => {
    const onPopState = () => setRoute(getPageFromPath(window.location.pathname));
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // WCAG 2.4.1/2.4.3: move focus to <main> after every route change so keyboard
  // and screen-reader users don't re-traverse the sidebar.
  useEffect(() => {
    if (user) mainRef.current?.focus({ preventScroll: true });
  }, [user, route.page, route.id]);

  // Unauthenticated users are redirected to the login route '/'
  useEffect(() => {
    if (!user && window.location.pathname !== '/') {
      window.history.replaceState({}, '', '/');
    }
  }, [user]);

  // Authenticated users landing on '/' (the virtual 'home' route) are sent to
  // their landing page so the shell is never empty. replaceState keeps history
  // clean (no extra entry for the redirect).
  useEffect(() => {
    if (user && route.page === 'home') {
      const landing = can(user, 'case.view') ? 'dashboard' : 'citizen';
      const path = getPath(landing);
      if (window.location.pathname !== path) {
        window.history.replaceState({}, '', path);
      }
      setRoute({ page: landing, id: null });
    }
  }, [user, route.page]);
  // Register service worker for offline fallback
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);

  // Online/offline detection
  useEffect(() => {
    const goOffline = () =>
      notify('Mất kết nối mạng. Một số tính năng có thể không hoạt động.', 'error');
    const goOnline = () => notify('Đã khôi phục kết nối mạng.', 'success');
    if (!navigator.onLine) goOffline();
    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);
    return () => {
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
    };
  }, []);

  useEffect(() => {
    if (!user) {
      request('/api/v1/auth/setup-status')
        .then((r) => setNeedsSetup(r.needsSetup))
        .catch(() => setNeedsSetup(false));
    }
  }, [user]);
  const logoutUser = async () => {
    await logout();
    nav('home');
    notify('Đã đăng xuất.', 'success');
  };
  const api = (path, opts) =>
    request(path, opts, () => {
      logout();
      notify('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.', 'error');
    });
  if (!user) {
    if (needsSetup === null) return <Loading />;
    if (needsSetup)
      return (
        <SetupAdminPage
          onSetup={(value) => {
            login(value);
            nav('admin-users');
          }}
        />
      );
    return (
      <Login
        onLogin={(value) => {
          login(value);
          nav(can(value, 'case.view') ? 'dashboard' : 'citizen');
        }}
        notice={notice}
      />
    );
  }
  const isOfficer = can(user, 'case.view');
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Bỏ qua điều hướng và đi tới nội dung chính
      </a>
      <header>
        <div
          className="logo"
          onClick={() => nav(isOfficer ? 'dashboard' : 'citizen')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              nav(isOfficer ? 'dashboard' : 'citizen');
            }
          }}
          role="button"
          tabIndex="0"
          aria-label="Về trang chủ"
        >
          QLTTXD
        </div>
        <div className="user-menu">
          <BellNotification api={api} />
          <span>{user.full_name || user.username}</span>
          <small>{user.roles?.join(', ') || 'Người dùng'}</small>
          <button className="logout" onClick={logoutUser}>
            Đăng xuất
          </button>
        </div>
      </header>
      <div className="body">
        <aside>
          <nav>
            {!isOfficer && can(user, 'report.create') && (
              <button
                aria-current={route.page === 'citizen' ? 'page' : undefined}
                className={route.page === 'citizen' ? 'selected' : ''}
                onClick={() => nav('citizen')}
              >
                <AlertCircle size={16} aria-hidden="true"/> Báo cáo vi phạm
              </button>
            )}
            {isOfficer && (
              <>
                <button
                  aria-current={route.page === 'dashboard' ? 'page' : undefined}
                  className={route.page === 'dashboard' ? 'selected' : ''}
                  onClick={() => nav('dashboard')}
                >
                  <LayoutDashboard size={16} aria-hidden="true"/> Tổng quan
                </button>
                <button
                  aria-current={
                    route.page === 'cases' || route.page === 'case' ? 'page' : undefined
                  }
                  className={route.page === 'cases' || route.page === 'case' ? 'selected' : ''}
                  onClick={() => nav('cases')}
                >
                  <FolderOpen size={16} aria-hidden="true"/> Hồ sơ xử lý
                </button>
                <button
                  aria-current={route.page === 'officer-reports' ? 'page' : undefined}
                  className={route.page === 'officer-reports' ? 'selected' : ''}
                  onClick={() => nav('officer-reports')}
                >
                  <NotebookText size={16} aria-hidden="true"/> Báo cáo vi phạm
                </button>
                {can(user, 'case.view') && (
                  <button
                    aria-current={route.page === 'ban-do' ? 'page' : undefined}
                    className={route.page === 'ban-do' ? 'selected' : ''}
                    onClick={() => nav('ban-do')}
                    >
                    <Map size={16} aria-hidden="true"/> Bản đồ
                  </button>
                )}
              </>
            )}
            {can(user, 'admin.users') && (
              <>
                <div className="nav-group">Quản trị</div>
                <button
                  aria-current={route.page === 'admin-users' ? 'page' : undefined}
                  className={route.page === 'admin-users' ? 'selected' : ''}
                  onClick={() => nav('admin-users')}
                >
                  <Users size={16} aria-hidden="true"/> Người dùng
                </button>
                <button
                  aria-current={route.page === 'admin-roles' ? 'page' : undefined}
                  className={route.page === 'admin-roles' ? 'selected' : ''}
                  onClick={() => nav('admin-roles')}
                >
                  <Key size={16} aria-hidden="true"/> Phân quyền
                </button>
                <button
                  aria-current={route.page === 'admin-audit' ? 'page' : undefined}
                  className={route.page === 'admin-audit' ? 'selected' : ''}
                  onClick={() => nav('admin-audit')}
                >
                  <ScrollText size={16} aria-hidden="true"/> Nhật ký hệ thống
                </button>
              </>
            )}
            {can(user, 'admin.locations') && (
              <button
                aria-current={route.page === 'admin-locations' ? 'page' : undefined}
                className={route.page === 'admin-locations' ? 'selected' : ''}
                onClick={() => nav('admin-locations')}
                >
                <Building2 size={16} aria-hidden="true"/> Địa điểm
              </button>
            )}
            {can(user, 'admin.users') && (
              <button
                aria-current={route.page === 'admin-catalog' ? 'page' : undefined}
                className={route.page === 'admin-catalog' ? 'selected' : ''}
                onClick={() => nav('admin-catalog')}
                >
                <BookOpen size={16} aria-hidden="true"/> Danh mục
              </button>
            )}
            {can(user, 'report.statistics') && (
              <button
                aria-current={route.page === 'report' ? 'page' : undefined}
                className={route.page === 'report' ? 'selected' : ''}
                onClick={() => nav('report')}
                >
                <BarChart3 size={16} aria-hidden="true"/> Báo cáo
              </button>
            )}
            <button
              aria-current={route.page === 'profile' ? 'page' : undefined}
              className={route.page === 'profile' ? 'selected' : ''}
              onClick={() => nav('profile')}
            >
              <User size={16} aria-hidden="true"/> Hồ sơ
            </button>
            <div className="permission">Quyền: {user.permissions?.join(', ') || '—'}</div>
          </nav>
        </aside>
        <main ref={mainRef} tabIndex={-1} id="main-content" className="content">
          <Notice notice={notice} onClose={() => setNotice(null)} />
          {route.page === 'citizen' && <CitizenPage api={api} notify={notify} />}
          {route.page === 'dashboard' && <Dashboard api={api} navigate={nav} notify={notify} />}
          {route.page === 'cases' && <CaseList api={api} navigate={nav} notify={notify} />}
          {route.page === 'case' && (
            <ErrorBoundary>
              <Suspense fallback={<Loading />}>
                <CaseDetail id={route.id} api={api} user={user} navigate={nav} notify={notify} />
              </Suspense>
            </ErrorBoundary>
          )}
          {route.page === 'admin-users' && (
            <ErrorBoundary>
              <Suspense fallback={<Loading />}>
                <AdminUsersPage api={api} notify={notify} />
              </Suspense>
            </ErrorBoundary>
          )}
          {route.page === 'admin-roles' && (
            <ErrorBoundary>
              <Suspense fallback={<Loading />}>
                <AdminRolesPage api={api} notify={notify} />
              </Suspense>
            </ErrorBoundary>
          )}
          {route.page === 'admin-locations' && (
            <ErrorBoundary>
              <Suspense fallback={<Loading />}>
                <AdminLocationsPage api={api} notify={notify} />
              </Suspense>
            </ErrorBoundary>
          )}
          {route.page === 'admin-catalog' && (
            <ErrorBoundary>
              <Suspense fallback={<Loading />}>
                <AdminCatalogPage api={api} notify={notify} />
              </Suspense>
            </ErrorBoundary>
          )}
          {route.page === 'admin-audit' && (
            <ErrorBoundary>
              <Suspense fallback={<Loading />}>
                <AdminAuditLogPage api={api} notify={notify} />
              </Suspense>
            </ErrorBoundary>
          )}
          {route.page === 'report' && (
            <ErrorBoundary>
              <Suspense fallback={<Loading />}>
                <ReportPage api={api} user={user} notify={notify} />
              </Suspense>
            </ErrorBoundary>
          )}
          {route.page === 'officer-reports' && (
            <ErrorBoundary>
              <Suspense fallback={<Loading />}>
                <OfficerReportsPage api={api} user={user} navigate={nav} notify={notify} />
              </Suspense>
            </ErrorBoundary>
          )}
          {route.page === 'ban-do' && (
            <ErrorBoundary>
              <Suspense fallback={<Loading />}>
                <BanDoPage api={api} notify={notify} />
              </Suspense>
            </ErrorBoundary>
          )}
          {route.page === 'profile' && <ProfilePage api={api} user={user} notify={notify} />}
          {![
            'home',
            'dashboard',
            'cases',
            'case',
            'citizen',
            'officer-reports',
            'ban-do',
            'admin-users',
            'admin-roles',
            'admin-audit',
            'admin-locations',
            'admin-catalog',
            'report',
            'profile',
          ].includes(route.page) && <NotFound navigate={nav} />}
        </main>
      </div>
    </div>
  );
}
createRoot(document.getElementById('root')).render(
  <ErrorBoundary>
    <AuthProvider>
      <ConfigProvider>
        <App />
      </ConfigProvider>
    </AuthProvider>
  </ErrorBoundary>
);
