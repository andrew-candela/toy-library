import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { logout, TOKEN_KEY } from '../api/client'
import { DESKTOP_SIDEBAR_WIDTH, MOBILE_RAIL_WIDTH } from '../theme/tokens'
import { useTheme } from '../theme/ThemeContext'

interface Props {
  onLogout: () => void
  isCompact?: boolean
}

function ToysIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="5" y="8" width="14" height="10" rx="3" stroke="currentColor" strokeWidth="1.8" />
      <path d="M9 8V6.5C9 5.67 9.67 5 10.5 5h3C14.33 5 15 5.67 15 6.5V8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="9" cy="13" r="1.2" fill="currentColor" />
      <circle cx="15" cy="13" r="1.2" fill="currentColor" />
      <path d="M12 15.2v1.1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

function UsersIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M6.5 18.5c1.2-2.6 3.1-4 5.5-4s4.3 1.4 5.5 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

function ProfileIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 4.8l1.1 1.5 1.9-.1.7 1.8 1.8.7-.1 1.9 1.5 1.1-1.5 1.1.1 1.9-1.8.7-.7 1.8-1.9-.1L12 19.2l-1.1-1.5-1.9.1-.7-1.8-1.8-.7.1-1.9-1.5-1.1 1.5-1.1-.1-1.9 1.8-.7.7-1.8 1.9.1L12 4.8z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="2.6" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  )
}

function LogoutIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M10 6H6.8C5.81 6 5 6.81 5 7.8v8.4C5 17.19 5.81 18 6.8 18H10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M13 8.5l3.5 3.5L13 15.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 12h7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

type NavIconProps = { active: boolean }

function NavItem({
  to,
  label,
  compact,
  active,
  style,
  icon,
}: {
  to: string
  label: string
  compact: boolean
  active: boolean
  style: React.CSSProperties
  icon: (props: NavIconProps) => React.ReactNode
}) {
  return (
    <Link to={to} style={style} aria-label={label} title={compact ? label : undefined}>
      {icon({ active })}
      {!compact && <span>{label}</span>}
    </Link>
  )
}

export default function Sidebar({ onLogout, isCompact = false }: Props) {
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
    display: 'flex',
    alignItems: 'center',
    justifyContent: isCompact ? 'center' : 'flex-start',
    gap: 10,
    padding: isCompact ? '12px 0' : '10px 16px',
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

  const navWidth = isCompact ? MOBILE_RAIL_WIDTH : DESKTOP_SIDEBAR_WIDTH

  return (
    <nav
      style={{
        width: navWidth,
        height: '100dvh',
        minHeight: '100vh',
        background: theme.surface,
        borderRight: `1px solid ${theme.border}`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: isCompact ? 'center' : 'stretch',
        paddingTop: isCompact ? 18 : 24,
        paddingInline: isCompact ? 10 : 12,
        paddingBottom: `calc(${isCompact ? 18 : 24}px + env(safe-area-inset-bottom, 0px))`,
        gap: 4,
        boxSizing: 'border-box',
        flexShrink: 0,
        overflowY: 'auto',
      }}
    >
      <Link
        to="/home"
        aria-label="Home"
        title={isCompact ? 'Home' : undefined}
        style={{
          fontWeight: 700,
          fontSize: isCompact ? 11 : 16,
          margin: isCompact ? '0 0 18px 0' : '0 0 16px 4px',
          color: theme.textPrimary,
          textDecoration: 'none',
          letterSpacing: isCompact ? '0.08em' : undefined,
          textTransform: isCompact ? 'uppercase' : undefined,
        }}
      >
        {isCompact ? 'TL' : 'Toy Library'}
      </Link>
      <NavItem to="/toys" label="Toys" compact={isCompact} active={location.pathname.startsWith('/toys')} style={linkStyle('/toys')} icon={ToysIcon} />
      <NavItem to="/users" label="Users" compact={isCompact} active={location.pathname.startsWith('/users')} style={linkStyle('/users')} icon={UsersIcon} />
      <NavItem to="/profile" label="Profile" compact={isCompact} active={location.pathname.startsWith('/profile')} style={linkStyle('/profile')} icon={ProfileIcon} />
      <div style={{ flex: 1 }} />
      <button
        type="button"
        onClick={handleLogout}
        disabled={loggingOut}
        aria-label="Sign out"
        title={isCompact ? 'Sign out' : undefined}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: isCompact ? 'center' : 'flex-start',
          gap: 10,
          padding: isCompact ? '12px 0' : '10px 16px',
          width: '100%',
          background: 'none',
          border: `1px solid ${theme.border}`,
          borderRadius: 6,
          cursor: loggingOut ? 'not-allowed' : 'pointer',
          textAlign: isCompact ? 'center' : 'left',
          fontWeight: 500,
          color: theme.textSecondary,
        }}
      >
        <LogoutIcon />
        {!isCompact && (loggingOut ? 'Signing out…' : 'Sign out')}
      </button>
    </nav>
  )
}
