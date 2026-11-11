import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import { ResidentLayout } from '@/components/layout/ResidentLayout';
import { GuestOnly, RequireAdmin, RequireAuth } from '@/components/layout/Guards';
import { FullPageSpinner } from '@/components/layout/FullPageSpinner';
import { BadgeWatcher } from '@/features/notifications/BadgeWatcher';
import { useSyncLocale } from '@/hooks/useAuth';
import HomeMapPage from '@/pages/HomeMapPage';

const EventsPage = lazy(() => import('@/pages/EventsPage'));
const EventDetailPage = lazy(() => import('@/pages/EventDetailPage'));
const LeaderboardPage = lazy(() => import('@/pages/LeaderboardPage'));
const LoginPage = lazy(() => import('@/pages/auth/LoginPage'));
const RegisterPage = lazy(() => import('@/pages/auth/RegisterPage'));
const ForgotPasswordPage = lazy(() => import('@/pages/auth/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('@/pages/auth/ResetPasswordPage'));
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'));
const ReportNewPage = lazy(() => import('@/pages/ReportNewPage'));
const ProfilePage = lazy(() => import('@/pages/ProfilePage'));
const NotificationsPage = lazy(() => import('@/pages/NotificationsPage'));
// Все страницы, кроме карты, грузятся по требованию — первый экран на телефоне открывается быстрее.
// Админка грузится отдельным чанком — житель её код не скачивает
const AdminRoutes = lazy(() => import('@/pages/admin/AdminRoutes'));

export default function App() {
  useSyncLocale();
  return (
    <>
      <BadgeWatcher />
      <Suspense fallback={<FullPageSpinner />}>
        <Routes>
          <Route element={<ResidentLayout />}>
            <Route index element={<HomeMapPage />} />
            <Route path="events" element={<EventsPage />} />
            <Route path="events/:id" element={<EventDetailPage />} />
            <Route path="leaderboard" element={<LeaderboardPage />} />
            <Route element={<RequireAuth />}>
              <Route path="report/new" element={<ReportNewPage />} />
              <Route path="profile" element={<ProfilePage />} />
              <Route path="notifications" element={<NotificationsPage />} />
            </Route>
            <Route path="login" element={<GuestOnly><LoginPage /></GuestOnly>} />
            <Route path="register" element={<GuestOnly><RegisterPage /></GuestOnly>} />
            <Route path="forgot-password" element={<ForgotPasswordPage />} />
            <Route path="reset-password" element={<ResetPasswordPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
          <Route
            path="admin/*"
            element={
              <RequireAdmin>
                <AdminRoutes />
              </RequireAdmin>
            }
          />
        </Routes>
      </Suspense>
    </>
  );
}
