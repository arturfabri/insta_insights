import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'sonner'
import { AuthProvider, useAuth } from '@/context/AuthContext'
import { GoalProvider } from '@/context/GoalContext'
import AppShell from '@/components/Layout/AppShell'
import ErrorBoundary from '@/components/ErrorBoundary'
import type { ReactNode } from 'react'

const LoginPage = lazy(() => import('@/pages/LoginPage'))
const SignupPage = lazy(() => import('@/pages/SignupPage'))
const ConnectPage = lazy(() => import('@/pages/ConnectPage'))
const OAuthFacebookCallbackPage = lazy(() => import('@/pages/OAuthFacebookCallbackPage'))
const DashboardPage = lazy(() => import('@/pages/DashboardPage'))
const PostDetailPage = lazy(() => import('@/pages/PostDetailPage'))
const RecommendationsPage = lazy(() => import('@/pages/RecommendationsPage'))

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div
          className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin"
          role="status"
          aria-label="Loading"
        />
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

function AppRoutes() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div
            className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin"
            role="status"
            aria-label="Loading"
          />
        </div>
      }
    >
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/oauth/facebook-callback" element={<OAuthFacebookCallbackPage />} />

        {/* Protected routes — wrapped in app shell */}
        <Route
          element={
            <ProtectedRoute>
              <AppShell />
            </ProtectedRoute>
          }
        >
          <Route path="/" element={<DashboardPage />} />
          <Route path="/posts/:id" element={<PostDetailPage />} />
          <Route path="/recommendations" element={<RecommendationsPage />} />
          <Route path="/connect" element={<ConnectPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <GoalProvider>
          <AppRoutes />
          <Toaster position="bottom-right" richColors closeButton />
        </GoalProvider>
      </AuthProvider>
    </ErrorBoundary>
  )
}
