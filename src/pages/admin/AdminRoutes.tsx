import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import AdminLayout from '@/components/layout/AdminLayout';
import { FullPageSpinner } from '@/components/layout/FullPageSpinner';
import DashboardPage from './DashboardPage';
import ReportsAdminPage from './ReportsAdminPage';
import EventsAdminPage from './EventsAdminPage';
import EventAdminDetailPage from './EventAdminDetailPage';
import UsersPage from './UsersPage';
import SettingsPage from './SettingsPage';
import NotFoundPage from '@/pages/NotFoundPage';

const MapBuilderPage = lazy(() => import('./MapBuilderPage'));

export default function AdminRoutes() {
  return (
    <Routes>
      <Route element={<AdminLayout />}>
        <Route index element={<DashboardPage />} />
        <Route path="reports" element={<ReportsAdminPage />} />
        <Route
          path="map"
          element={
            <Suspense fallback={<FullPageSpinner />}>
              <MapBuilderPage />
            </Suspense>
          }
        />
        <Route path="events" element={<EventsAdminPage />} />
        <Route path="events/:id" element={<EventAdminDetailPage />} />
        <Route path="users" element={<UsersPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
