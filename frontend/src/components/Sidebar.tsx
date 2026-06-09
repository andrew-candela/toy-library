import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { logout, TOKEN_KEY } from '../api/client'
import { useTheme } from '../theme/ThemeContext'

interface Props {
  onLogout: () => void
}

export default function Sidebar({ onLogout }: Props) {
  const [loggingOut, setLoggingOut] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const { theme } = useTheme()

  async function handleLogout() {
    setLoggingOut(true)
    const token = sessionStorage.getItem(TOKEN_KEY) ?? ''
    try {
      await logout(token)
    } finally {
      sessionStorage.removeItem(TOKEN_KEY)
      onLogout()
      navigate('/login', { replace: true })
    }
  }

  const navLinkStyle: React.CSSProperties = {
    display: 'block',
    padding: '10px 16px',
    color: theme.navLinkColor,
    textDecoration: 'none',
    borderRadius: 6,
    fontWeight: 500,
  }

  const activeNavLinkStyle: React.CSSProperties = {
    ...navLinkStyle,
    background: theme.chipBg,
    color: theme.chipText,
  }

  function linkStyle(path: string): React.CSSProperties {
    return location.pathname.startsWith(path) ? activeNavLinkStyle : navLinkStyle
  }

  return (
    <nav
      style={{
        width: 200,
        minHeight: '100vh',
        background: theme.surface,
        borderRight: `1px solid ${theme.border}`,
        display: 'flex',
        flexDirection: 'column',
        padding: '24px 12px',
        gap: 4,
        boxSizing: 'border-box',
        flexShrink: 0,
      }}
    >
      <Link
        to="/home"
        style={{ fontWeight: 700, fontSize: 16, margin: '0 0 16px 4px', color: theme.textPrimary, textDecoration: 'none' }}
      >
        Toy Library
      </Link>
      <Link to="/toys" style={linkStyle('/toys')}>Toys</Link>
      <Link to="/users" style={linkStyle('/users')}>Users</Link>
      <Link to="/profile" style={linkStyle('/profile')}>Profile</Link>
      <div style={{ flex: 1 }} />
      <button
        type="button"
        onClick={handleLogout}
        disabled={loggingOut}
        style={{
          padding: '10px 16px',
          background: 'none',
          border: `1px solid ${theme.border}`,
          borderRadius: 6,
          cursor: loggingOut ? 'not-allowed' : 'pointer',
          textAlign: 'left',
          fontWeight: 500,
          color: theme.textSecondary,
        }}
      >
        {loggingOut ? 'Signing out…' : 'Sign out'}
      </button>
    </nav>
  )
}
