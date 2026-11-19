import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom';
import './styles.css';
import { AuthProvider, RequireAdmin } from '@/components/Auth';
import { ToastProvider } from '@/components/Toast';
import { Layout } from '@/components/Layout';
import { LoginPage } from '@/pages/LoginPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { PlayerDetailPage, PlayersPage } from '@/pages/PlayersPage';
import { RoomsPage } from '@/pages/GamesPage';
import { AuditPage, SettingsPage } from '@/pages/ConfigPages';
import { CrashesPage } from '@/pages/CrashesPage';

const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    path: '/',
    element: (
      <RequireAdmin>
        <Layout />
      </RequireAdmin>
    ),
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'players', element: <PlayersPage /> },
      { path: 'players/:id', element: <PlayerDetailPage /> },
      { path: 'rooms', element: <RoomsPage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: 'audit', element: <AuditPage /> },
      { path: 'crashes', element: <CrashesPage /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <ToastProvider>
        <RouterProvider router={router} />
      </ToastProvider>
    </AuthProvider>
  </StrictMode>,
);
