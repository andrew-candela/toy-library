import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getUserProfile, type ProfileResponse } from '../../api/client'
import { useTheme } from '../../theme/ThemeContext'

interface Props {
  token: string
}

export default function UserProfilePage({ token }: Props) {
  const { username } = useParams<{ username: string }>()
  const [profile, setProfile] = useState<ProfileResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { theme } = useTheme()

  useEffect(() => {
    if (!username) return
    setLoading(true)
    setError(null)
    getUserProfile(token, username)
      .then((p) => {
        setProfile(p)
        setLoading(false)
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to load profile')
        setLoading(false)
      })
  }, [token, username])

  const sectionStyle: React.CSSProperties = {
    marginBottom: 28,
    paddingBottom: 24,
    borderBottom: `1px solid ${theme.border}`,
  }

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontWeight: 600,
    marginBottom: 6,
    fontSize: 13,
    color: theme.textLabel,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  }

  const valueStyle: React.CSSProperties = {
    fontSize: 15,
    color: theme.textPrimary,
    margin: 0,
  }

  if (loading) {
    return <div style={{ padding: 40, color: theme.textPrimary }}>Loading…</div>
  }

  if (error) {
    return <div style={{ padding: 40, color: theme.error }}>{error}</div>
  }

  if (!profile) return null

  return (
    <div style={{ padding: 40, maxWidth: 520 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 32 }}>{profile.username}</h1>

      <div style={sectionStyle}>
        <span style={labelStyle}>Username</span>
        <p style={valueStyle}>{profile.username}</p>
      </div>

      <div style={sectionStyle}>
        <span style={labelStyle}>
          Email{' '}
          {profile.is_email_verified ? (
            <span
              style={{
                color: theme.success,
                fontWeight: 400,
                fontSize: 12,
                textTransform: 'none',
                letterSpacing: 0,
              }}
            >
              ✓ verified
            </span>
          ) : (
            <span
              style={{
                color: theme.warning,
                fontWeight: 400,
                fontSize: 12,
                textTransform: 'none',
                letterSpacing: 0,
              }}
            >
              ⚠ unverified
            </span>
          )}
        </span>
        <p style={valueStyle}>{profile.email}</p>
      </div>

      <div style={{ ...sectionStyle, borderBottom: 'none', marginBottom: 0, paddingBottom: 0 }}>
        <span style={labelStyle}>Neighborhood</span>
        <p
          style={{
            ...valueStyle,
            color: profile.neighborhood ? theme.textPrimary : theme.textMuted,
          }}
        >
          {profile.neighborhood ?? 'Not set'}
        </p>
      </div>

      <div style={{ marginTop: 28 }}>
        <Link
          to={`/items?owner=${encodeURIComponent(profile.username)}`}
          style={{ color: theme.link, fontSize: 14, textDecoration: 'none', fontWeight: 500 }}
        >
          View items owned by {profile.username} →
        </Link>
      </div>
    </div>
  )
}
