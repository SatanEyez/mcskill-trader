import { useEffect, useRef, type ReactNode } from 'react';
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { LayoutGrid } from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { HomePage } from './pages/HomePage';
import { ResourcesPage } from './pages/ResourcesPage';
import { TradePage } from './pages/TradePage';
import { ReportPage } from './pages/ReportPage';
import { NewsPage } from './pages/NewsPage';
import { NewsPostPage } from './pages/NewsPostPage';
import { AdminLoginPage } from './pages/AdminLoginPage';
import { AdminPage } from './pages/AdminPage';
import { AdminCategoriesPage } from './pages/AdminCategoriesPage';
import { AdminChatPage } from './pages/AdminChatPage';
import { AdminUsersPage } from './pages/AdminUsersPage';
import { AdminLogsPage } from './pages/AdminLogsPage';
import { AdminAccessPage } from './pages/AdminAccessPage';
import { AdminSupportPage } from './pages/AdminSupportPage';
import { AdminImportPage } from './pages/AdminImportPage';
import { AdminProfilePage } from './pages/AdminProfilePage';
import { AdminPanelPage } from './pages/AdminPanelPage';
import { AdminNewsPage } from './pages/AdminNewsPage';
import { AdminStatsPage } from './pages/AdminStatsPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { AdminHeader } from './components/admin/AdminHeader';
import { AdminTabs } from './components/admin/AdminTabs';
import { PageLoader } from './components/ui/Spinner';
import { trackVisit } from './lib/api';

function ScrollToTopOnNavigate() {
  const location = useLocation();

  useEffect(() => {
    if (!location.hash) {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    }
  }, [location.pathname, location.hash]);

  return null;
}

/**
 * Отправляет просмотр страницы в статистику.
 * Админку не считаем: это владельцы, а не посетители сайта.
 */
function VisitTracker() {
  const location = useLocation();
  const lastTracked = useRef('');

  useEffect(() => {
    const path = `${location.pathname}${location.search}`;

    if (path.startsWith('/admin')) return;
    if (lastTracked.current === path) return;

    const referrer = lastTracked.current || document.referrer;
    lastTracked.current = path;

    void trackVisit(path, referrer);
  }, [location.pathname, location.search]);

  return null;
}

function RequireAdmin({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const location = useLocation();

  if (status === 'loading') {
    return (
      <div className="container-page">
        <PageLoader label="Проверяем авторизацию…" />
      </div>
    );
  }

  if (status === 'anonymous') {
    return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}

function RequirePermission({
  children,
  permission,
  anyPermission,
}: {
  children: ReactNode;
  permission?: string;
  anyPermission?: string;
}) {
  const { status, can } = useAuth();
  const location = useLocation();

  if (status === 'loading') {
    return (
      <div className="container-page">
        <PageLoader label="Проверяем права…" />
      </div>
    );
  }

  if (status === 'anonymous') {
    return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />;
  }

  const allowed = anyPermission
    ? can(anyPermission) || (permission ? can(permission) : false)
    : !permission || can(permission);

  if (!allowed) {
    return (
      <div className="min-h-screen">
        <AdminHeader />
        <AdminTabs />
        <main className="container-page py-16">
          <div className="panel mx-auto max-w-lg px-6 py-12 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-rose-300">
              Доступ ограничен
            </p>
            <h1 className="mt-2 text-xl font-semibold text-white">Недостаточно прав</h1>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">
              Ваша роль не включает доступ к этому разделу. Попросите владельца выдать
              подходящую роль в разделе «Доступ».
            </p>
            <Link to="/admin/panel" className="btn btn-secondary mt-5 px-3.5 py-2 text-xs">
              <LayoutGrid className="h-3.5 w-3.5" aria-hidden />
              В панель управления
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return <>{children}</>;
}

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <ScrollToTopOnNavigate />
          <VisitTracker />
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/resources" element={<ResourcesPage />} />
            <Route path="/trade" element={<TradePage />} />
            <Route path="/report" element={<ReportPage />} />
            <Route path="/news" element={<NewsPage />} />
            <Route path="/news/:id" element={<NewsPostPage />} />
            <Route path="/admin/login" element={<AdminLoginPage />} />
            <Route
              path="/admin"
              element={
                <RequireAdmin>
                  <RequirePermission permission="resources.read">
                    <AdminPage />
                  </RequirePermission>
                </RequireAdmin>
              }
            />
            <Route
              path="/admin/panel"
              element={
                <RequireAdmin>
                  <AdminPanelPage />
                </RequireAdmin>
              }
            />
            <Route
              path="/admin/profile"
              element={
                <RequireAdmin>
                  <AdminProfilePage />
                </RequireAdmin>
              }
            />
            <Route
              path="/admin/categories"
              element={
                <RequireAdmin>
                  <RequirePermission permission="categories.read">
                    <AdminCategoriesPage />
                  </RequirePermission>
                </RequireAdmin>
              }
            />
            <Route
              path="/admin/users"
              element={
                <RequireAdmin>
                  <RequirePermission permission="users.read">
                    <AdminUsersPage />
                  </RequirePermission>
                </RequireAdmin>
              }
            />
            <Route
              path="/admin/support"
              element={
                <RequireAdmin>
                  <RequirePermission permission="support.read">
                    <AdminSupportPage />
                  </RequirePermission>
                </RequireAdmin>
              }
            />
            <Route
              path="/admin/access"
              element={
                <RequireAdmin>
                  <RequirePermission
                    permission="roles.manage"
                    anyPermission="prefixes.manage"
                  >
                    <AdminAccessPage />
                  </RequirePermission>
                </RequireAdmin>
              }
            />
            <Route
              path="/admin/import"
              element={
                <RequireAdmin>
                  <RequirePermission permission="import.run">
                    <AdminImportPage />
                  </RequirePermission>
                </RequireAdmin>
              }
            />
            <Route
              path="/admin/news"
              element={
                <RequireAdmin>
                  <RequirePermission permission="news.write">
                    <AdminNewsPage />
                  </RequirePermission>
                </RequireAdmin>
              }
            />
            <Route
              path="/admin/stats"
              element={
                <RequireAdmin>
                  <RequirePermission permission="stats.view">
                    <AdminStatsPage />
                  </RequirePermission>
                </RequireAdmin>
              }
            />
            <Route
              path="/admin/chat"
              element={
                <RequireAdmin>
                  <RequirePermission permission="chat.use">
                    <AdminChatPage />
                  </RequirePermission>
                </RequireAdmin>
              }
            />
            <Route
              path="/admin/logs"
              element={
                <RequireAdmin>
                  <RequirePermission permission="logs.read">
                    <AdminLogsPage />
                  </RequirePermission>
                </RequireAdmin>
              }
            />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
