import { useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { TOKEN_KEY } from './api/client'
import HomePage from './components/HomePage'
import ItemList from './components/ItemList'
import LoginPage from './components/LoginPage'
import Sidebar from './components/Sidebar'
import VerifyEmailPage from './components/VerifyEmailPage'

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

  function handleLogout() {
    setToken(null)
  }

  function handleLogin() {
    setToken(sessionStorage.getItem(TOKEN_KEY))
  }

  return (
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
        path="/items"
        element={
          <ProtectedLayout onLogout={handleLogout}>
            <ItemList token={token!} />
          </ProtectedLayout>
        }
      />
      <Route path="/verify-email" element={<VerifyEmailPage />} />
      <Route path="/" element={<Navigate to="/home" replace />} />
      <Route path="*" element={<Navigate to="/home" replace />} />
    </Routes>
  )
}

export default App
