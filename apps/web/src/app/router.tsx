import { useTranslation } from 'react-i18next';
import { Navigate, Outlet, createBrowserRouter, useLocation } from 'react-router';
import { useSession } from './session-context.tsx';

function RequireSession() {
  const { session, loading } = useSession();
  const location = useLocation();
  const { t } = useTranslation();
  if (loading) return <p>{t('common.loading')}</p>;
  if (session === null) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <Outlet />;
}

function AppLayout() {
  const { t } = useTranslation();
  return (
    <div className="app-layout">
      <header>
        <strong>{t('common.appName')}</strong>
        {/* Organization switcher slot — filled by FEAT_WEB/organization-switcher (US2). */}
        <div data-slot="organization-switcher" />
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  );
}

function NotFound() {
  const { t } = useTranslation();
  return <p>{t('common.notFound')}</p>;
}

/** Route tree; feature pages are attached by their user stories. */
export const router = createBrowserRouter([
  {
    element: <RequireSession />,
    children: [{ element: <AppLayout />, children: [{ path: '/', element: <div /> }] }],
  },
  { path: '/login', element: <div /> },
  { path: '*', element: <NotFound /> },
]);
