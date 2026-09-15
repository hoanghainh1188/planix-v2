import { useTranslation } from 'react-i18next';
import { Navigate, Outlet, createBrowserRouter, useLocation } from 'react-router';
import { AcceptInvitationPage } from '../features/organization-access/accept-invitation/AcceptInvitationPage.tsx';
import { LoginPage } from '../features/organization-access/login/LoginPage.tsx';
import { OrganizationSwitcher } from '../features/organization-access/organization-switcher/OrganizationSwitcher.tsx';
import { ConfirmResetPage } from '../features/organization-access/password-reset/ConfirmResetPage.tsx';
import { RequestResetPage } from '../features/organization-access/password-reset/RequestResetPage.tsx';
import { PlatformOrganizationsPage } from '../features/organization-access/platform/PlatformOrganizationsPage.tsx';
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
        <OrganizationSwitcher />
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  );
}

/** Organization routes need an active organization; otherwise show the chooser. */
function RequireActiveOrganization() {
  const { session } = useSession();
  if (session?.activeOrganizationId === null) {
    return (
      <div className="auth-page">
        <OrganizationSwitcher variant="page" />
      </div>
    );
  }
  return <Outlet />;
}

function Home() {
  const { t } = useTranslation();
  const { session } = useSession();
  const organization = session?.memberships.find((m) => m.organizationId === session.activeOrganizationId);
  return <h1>{organization?.organizationName ?? t('common.appName')}</h1>;
}

function NotFound() {
  const { t } = useTranslation();
  return <p>{t('common.notFound')}</p>;
}

/** Route tree; feature pages are attached by their user stories. */
export const router = createBrowserRouter([
  {
    element: <RequireSession />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { path: '/platform/organizations', element: <PlatformOrganizationsPage /> },
          { element: <RequireActiveOrganization />, children: [{ path: '/', element: <Home /> }] },
        ],
      },
    ],
  },
  { path: '/login', element: <LoginPage /> },
  { path: '/invitations/:token', element: <AcceptInvitationPage /> },
  { path: '/password-reset', element: <RequestResetPage /> },
  { path: '/password-reset/:token', element: <ConfirmResetPage /> },
  { path: '*', element: <NotFound /> },
]);
