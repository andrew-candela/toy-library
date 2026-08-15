import { useEffect, useState } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { TOKEN_KEY, getProfile, getStoredToken, setStoredToken } from './api/client'
import AdminPage from './components/AdminPage'
import ForgotPasswordPage from './components/ForgotPasswordPage'
import HomePage from './components/HomePage'
import ResendVerificationPage from './components/ResendVerificationPage'
import LoginPage from './components/LoginPage'
import ProfilePage from './components/ProfilePage'
import ResetPasswordPage from './components/ResetPasswordPage'
import Sidebar from './components/Sidebar'
import ToysPage from './components/toy_page/ToysPage'
import ToyDetailPage from './components/ToyDetailPage'
import VerifyEmailPage from './components/VerifyEmailPage'
import { UsersPage } from './components/user_page/UsersPage'
import { UserDetailPage } from './components/user_page/UserDetailPage'
import { DESKTOP_SIDEBAR_WIDTH, MOBILE_RAIL_WIDTH } from './theme/tokens'
import { useIsCompactLayout } from './theme/useIsCompactLayout'
import { useTheme } from './theme/ThemeContext'

function ProtectedLayout({
  children,
  onLogout,
  adminOnly = false,
}: {
  children: React.ReactNode
  onLogout: () => void
  adminOnly?: boolean
}) {
  const token = getStoredToken()
  const location = useLocation()
  const isCompactSidebar = useIsCompactLayout()
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)

  useEffect(() => {
    if (!token) {
      return
    }
    let cancelled = false
    getProfile(token)
      .then((profile) => {
        if (!cancelled) {
          setIsAdmin(profile.is_admin ?? false)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setIsAdmin(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [token])

  if (!token) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  if (adminOnly && isAdmin === false) {
    return <Navigate to="/home" replace />
  }

  const sidebarWidth = isCompactSidebar ? MOBILE_RAIL_WIDTH : DESKTOP_SIDEBAR_WIDTH

  return (
    <div style={{ display: 'flex', height: '100dvh', minHeight: '100vh', overflow: 'hidden' }}>
      <Sidebar onLogout={onLogout} isCompact={isCompactSidebar} isAdmin={isAdmin} />
      <div
        style={{
          flex: 1,
          minWidth: 0,
          height: '100%',
          width: `calc(100vw - ${sidebarWidth}px)`,
          overflowX: 'hidden',
          overflowY: 'auto',
        }}
      >
        {adminOnly && isAdmin === null ? null : children}
      </div>
    </div>
  )
}

function App() {
  // token state drives re-renders after login/logout
  const [token, setToken] = useState<string | null>(() => getStoredToken())
  const { theme } = useTheme()

  useEffect(() => {
    function handleStorage(event: StorageEvent) {
      if (event.key === TOKEN_KEY) {
        setToken(getStoredToken())
      }
    }

    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [])

  function handleLogout() {
    setToken(null)
  }

  function handleLogin() {
    setToken(getStoredToken())
  }

  function handleTokenUpdate(newToken: string) {
    setStoredToken(newToken)
    setToken(newToken)
  }

  return (
    <div style={{ background: theme.bg, color: theme.textPrimary, minHeight: '100vh' }}>
      <Routes>
        <Route path="/login" element={<LoginPage onLogin={handleLogin} />} />
        <Route
          path="/home"
          element={
            <ProtectedLayout onLogout={handleLogout}>
              <HomePage />
            </ProtectedLayout>
          }
        />
        <Route
          path="/toys"
          element={
            <ProtectedLayout onLogout={handleLogout}>
              <ToysPage token={token!} />
            </ProtectedLayout>
          }
        />
        <Route
          path="/toys/:id"
          element={
            <ProtectedLayout onLogout={handleLogout}>
              <ToyDetailPage token={token!} />
            </ProtectedLayout>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedLayout onLogout={handleLogout}>
              <ProfilePage token={token!} onTokenUpdate={handleTokenUpdate} />
            </ProtectedLayout>
          }
        />
        <Route
          path="/users"
          element={
            <ProtectedLayout onLogout={handleLogout}>
              <UsersPage token={token!} />
            </ProtectedLayout>
          }
        />
        <Route
          path="/users/:username"
          element={
            <ProtectedLayout onLogout={handleLogout}>
              <UserDetailPage token={token!} />
            </ProtectedLayout>
          }
        />
        <Route
          path="/admin"
          element={
            <ProtectedLayout onLogout={handleLogout} adminOnly>
              <AdminPage token={token!} />
            </ProtectedLayout>
          }
        />
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/resend-verification" element={<ResendVerificationPage />} />
        <Route path="/" element={<Navigate to="/home" replace />} />
        <Route path="*" element={<Navigate to="/home" replace />} />
      </Routes>
    </div>
  )
}

export default App
