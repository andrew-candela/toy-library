import { useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { TOKEN_KEY } from './api/client'
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
import { useTheme } from './theme/ThemeContext'

function ProtectedLayout({ children, onLogout }: { children: React.ReactNode; onLogout: () => void }) {
  const token = sessionStorage.getItem(TOKEN_KEY)
  if (!token) {
    return <Navigate to="/login" replace />
  }
  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar onLogout={onLogout} />
      <div style={{ flex: 1, overflow: 'auto' }}>{children}</div>
    </div>
  )
}

function App() {
  // token state drives re-renders after login/logout
  const [token, setToken] = useState<string | null>(() =>
    sessionStorage.getItem(TOKEN_KEY),
  )
  const { theme } = useTheme()

  function handleLogout() {
    setToken(null)
  }

  function handleLogin() {
    setToken(sessionStorage.getItem(TOKEN_KEY))
  }

  function handleTokenUpdate(newToken: string) {
    sessionStorage.setItem(TOKEN_KEY, newToken)
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
