import { lazy } from 'react';

const LoginPage = lazy(() => import('@/pages/Login/Login'));
const SignupPage = lazy(() => import('@/pages/Signup/Signup'));
const VerifyEmailPage = lazy(() => import('@/pages/VerifyEmail/VerifyEmail'));
const FeedPage = lazy(() => import('@/pages/Feed/Feed'));
const RequestsPage = lazy(() => import('@/pages/Requests/Requests'));
const ConnectionsPage = lazy(() => import('@/pages/Connections/Connections'));
const ProfilePage = lazy(() => import('@/pages/Profile/Profile'));
const MessagesPage = lazy(() => import('@/pages/Messages/Messages'));
const BillingPage = lazy(() => import('@/pages/Billing/Billing'));

// guard: 'protected'   — redirect to /login if not authenticated
// guard: 'public-only' — redirect to / if already authenticated
// guard: 'open'        — no redirect
export const routes = [
  { path: '/login', Page: LoginPage, guard: 'public-only' },
  { path: '/signup', Page: SignupPage, guard: 'public-only' },
  { path: '/verify-email/:token', Page: VerifyEmailPage, guard: 'open' },
  { path: '/', Page: FeedPage, guard: 'protected' },
  { path: '/requests', Page: RequestsPage, guard: 'protected' },
  { path: '/connections', Page: ConnectionsPage, guard: 'protected' },
  { path: '/messages', Page: MessagesPage, guard: 'protected' },
  { path: '/profile', Page: ProfilePage, guard: 'protected' },
  { path: '/billing', Page: BillingPage, guard: 'protected' },
];
