import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { logout, TOKEN_KEY } from '../api/client'

interface Props {
  onLogout: () => void
}

export default function Sidebar({ onLogout }: Props) {
  const [loggingOut, setLoggingOut] = useState(false)
  const navigate = useNavigate()

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
    color: '#333',
    textDecoration: 'none',
    borderRadius: 6,
    fontWeight: 500,
  }

  return (
    <nav
      style={{
        width: 200,
        minHeight: '100vh',
        background: '#f4f4f5',
        borderRight: '1px solid #e4e4e7',
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
        style={{ fontWeight: 700, fontSize: 16, margin: '0 0 16px 4px', color: '#111', textDecoration: 'none' }}
      >
        Toy Library
      </Link>
      <Link to="/items" style={navLinkStyle}>
        Items
      </Link>
      <div style={{ flex: 1 }} />
      <button
        type="button"
        onClick={handleLogout}
        disabled={loggingOut}
        style={{
          padding: '10px 16px',
          background: 'none',
          border: '1px solid #e4e4e7',
          borderRadius: 6,
          cursor: loggingOut ? 'not-allowed' : 'pointer',
          textAlign: 'left',
          fontWeight: 500,
          color: '#555',
        }}
      >
        {loggingOut ? 'Signing out…' : 'Sign out'}
      </button>
    </nav>
  )
}
