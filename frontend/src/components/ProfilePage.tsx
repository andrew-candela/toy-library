import { useEffect, useState } from 'react'
import {
  getProfile,
  setStoredToken,
  updateEmail,
  updateNeighborhood,
  updateUsername,
} from '../api/client'
import { useTheme } from '../theme/ThemeContext'
import { useIsCompactLayout } from '../theme/useIsCompactLayout'

interface Props {
  token: string
  onTokenUpdate: (newToken: string) => void
}

interface FieldState {
  value: string
  saving: boolean
  success: string | null
  error: string | null
}

function makeField(initial: string): FieldState {
  return { value: initial, saving: false, success: null, error: null }
}

export default function ProfilePage({ token, onTokenUpdate }: Props) {
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const { theme, isDark, toggleTheme } = useTheme()
  const isCompactLayout = useIsCompactLayout()

  const [isEmailVerified, setIsEmailVerified] = useState(false)
  const [username, setUsername] = useState<FieldState>(makeField(''))
  const [email, setEmail] = useState<FieldState>(makeField(''))
  const [neighborhood, setNeighborhood] = useState<FieldState>(makeField(''))

  useEffect(() => {
    getProfile(token)
      .then((profile) => {
        setIsEmailVerified(profile.is_email_verified)
        setUsername(makeField(profile.username))
        setEmail(makeField(profile.email))
        setNeighborhood(makeField(profile.neighborhood ?? ''))
        setLoading(false)
      })
      .catch((err: unknown) => {
        setLoadError(err instanceof Error ? err.message : 'Failed to load profile')
        setLoading(false)
      })
  }, [token])

  async function handleSaveUsername() {
    setUsername((s) => ({ ...s, saving: true, success: null, error: null }))
    try {
      const res = await updateUsername(token, username.value.trim())
      setStoredToken(res.access_token)
      onTokenUpdate(res.access_token)
      setUsername((s) => ({ ...s, saving: false, success: 'Username updated.' }))
    } catch (err: unknown) {
      setUsername((s) => ({
        ...s,
        saving: false,
        error: err instanceof Error ? err.message : 'Failed to update username',
      }))
    }
  }

  async function handleSaveEmail() {
    setEmail((s) => ({ ...s, saving: true, success: null, error: null }))
    try {
      const res = await updateEmail(token, email.value.trim())
      setIsEmailVerified(false)
      setEmail((s) => ({ ...s, saving: false, success: res.message }))
    } catch (err: unknown) {
      setEmail((s) => ({
        ...s,
        saving: false,
        error: err instanceof Error ? err.message : 'Failed to update email',
      }))
    }
  }

  async function handleSaveNeighborhood() {
    setNeighborhood((s) => ({ ...s, saving: true, success: null, error: null }))
    const value = neighborhood.value.trim() || null
    try {
      const res = await updateNeighborhood(token, value)
      setNeighborhood((s) => ({
        ...s,
        value: res.neighborhood ?? '',
        saving: false,
        success: 'Neighborhood updated.',
      }))
    } catch (err: unknown) {
      setNeighborhood((s) => ({
        ...s,
        saving: false,
        error: err instanceof Error ? err.message : 'Failed to update neighborhood',
      }))
    }
  }

  const inputStyle: React.CSSProperties = {
    padding: '8px 10px',
    border: `1px solid ${theme.inputBorder}`,
    borderRadius: 6,
    fontSize: 14,
    width: isCompactLayout ? '100%' : 280,
    boxSizing: 'border-box',
    background: theme.inputBg,
    color: theme.textPrimary,
  }

  const saveButtonStyle: React.CSSProperties = {
    padding: '8px 18px',
    background: theme.primaryBtnBg,
    color: theme.primaryBtnText,
    border: 'none',
    borderRadius: 6,
    cursor: 'pointer',
    fontWeight: 500,
    fontSize: 14,
  }

  const sectionStyle: React.CSSProperties = {
    marginBottom: 32,
    paddingBottom: 28,
    borderBottom: `1px solid ${theme.border}`,
  }

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontWeight: 600,
    marginBottom: 6,
    fontSize: 14,
    color: theme.textLabel,
  }

  if (loading) {
    return (
      <div style={{ padding: isCompactLayout ? 16 : 40, color: theme.textPrimary }}>
        Loading profile…
      </div>
    )
  }

  if (loadError) {
    return <div style={{ padding: isCompactLayout ? 16 : 40, color: theme.error }}>{loadError}</div>
  }

  return (
    <div style={{ padding: isCompactLayout ? 16 : 40, maxWidth: 520 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 32 }}>Profile</h1>

      {/* Username */}
      <div style={sectionStyle}>
        <label style={labelStyle}>Username</label>
        <div
          style={{
            display: 'flex',
            gap: 10,
            alignItems: isCompactLayout ? 'stretch' : 'center',
            flexDirection: isCompactLayout ? 'column' : 'row',
          }}
        >
          <input
            style={inputStyle}
            value={username.value}
            onChange={(e) =>
              setUsername((s) => ({ ...s, value: e.target.value, success: null, error: null }))
            }
            disabled={username.saving}
          />
          <button
            style={{ ...saveButtonStyle, opacity: username.saving ? 0.6 : 1 }}
            onClick={handleSaveUsername}
            disabled={username.saving}
          >
            {username.saving ? 'Saving…' : 'Save'}
          </button>
        </div>
        {username.success && (
          <p style={{ color: theme.success, fontSize: 13, marginTop: 6 }}>{username.success}</p>
        )}
        {username.error && (
          <p style={{ color: theme.error, fontSize: 13, marginTop: 6 }}>{username.error}</p>
        )}
      </div>

      {/* Email */}
      <div style={sectionStyle}>
        <label style={labelStyle}>
          Email address{' '}
          {isEmailVerified ? (
            <span style={{ color: theme.success, fontWeight: 400, fontSize: 12 }}>✓ verified</span>
          ) : (
            <span style={{ color: theme.warning, fontWeight: 400, fontSize: 12 }}>
              ⚠ unverified — check your inbox
            </span>
          )}
        </label>
        <div
          style={{
            display: 'flex',
            gap: 10,
            alignItems: isCompactLayout ? 'stretch' : 'center',
            flexDirection: isCompactLayout ? 'column' : 'row',
          }}
        >
          <input
            style={inputStyle}
            type="email"
            value={email.value}
            onChange={(e) =>
              setEmail((s) => ({ ...s, value: e.target.value, success: null, error: null }))
            }
            disabled={email.saving}
          />
          <button
            style={{ ...saveButtonStyle, opacity: email.saving ? 0.6 : 1 }}
            onClick={handleSaveEmail}
            disabled={email.saving}
          >
            {email.saving ? 'Saving…' : 'Save'}
          </button>
        </div>
        {email.success && (
          <p style={{ color: theme.info, fontSize: 13, marginTop: 6 }}>{email.success}</p>
        )}
        {email.error && (
          <p style={{ color: theme.error, fontSize: 13, marginTop: 6 }}>{email.error}</p>
        )}
      </div>

      {/* Neighborhood */}
      <div style={{ ...sectionStyle, borderBottom: 'none', marginBottom: 0, paddingBottom: 0 }}>
        <label style={labelStyle}>Neighborhood</label>
        <div
          style={{
            display: 'flex',
            gap: 10,
            alignItems: isCompactLayout ? 'stretch' : 'center',
            flexDirection: isCompactLayout ? 'column' : 'row',
          }}
        >
          <input
            style={inputStyle}
            value={neighborhood.value}
            placeholder="e.g. Linda Mar"
            onChange={(e) =>
              setNeighborhood((s) => ({ ...s, value: e.target.value, success: null, error: null }))
            }
            disabled={neighborhood.saving}
          />
          <button
            style={{ ...saveButtonStyle, opacity: neighborhood.saving ? 0.6 : 1 }}
            onClick={handleSaveNeighborhood}
            disabled={neighborhood.saving}
          >
            {neighborhood.saving ? 'Saving…' : 'Save'}
          </button>
        </div>
        {neighborhood.success && (
          <p style={{ color: theme.success, fontSize: 13, marginTop: 6 }}>{neighborhood.success}</p>
        )}
        {neighborhood.error && (
          <p style={{ color: theme.error, fontSize: 13, marginTop: 6 }}>{neighborhood.error}</p>
        )}
      </div>

      {/* Appearance */}
      <div style={{ marginTop: 32, paddingTop: 28, borderTop: `1px solid ${theme.border}` }}>
        <label style={labelStyle}>Appearance</label>
        <div
          style={{
            display: 'flex',
            alignItems: isCompactLayout ? 'flex-start' : 'center',
            gap: 12,
            flexDirection: isCompactLayout ? 'column' : 'row',
          }}
        >
          <button
            type="button"
            onClick={toggleTheme}
            style={{
              padding: '8px 18px',
              background: theme.surface,
              color: theme.textPrimary,
              border: `1px solid ${theme.border}`,
              borderRadius: 6,
              cursor: 'pointer',
              fontWeight: 500,
              fontSize: 14,
              width: isCompactLayout ? '100%' : undefined,
            }}
          >
            {isDark ? '☀ Switch to Light mode' : '☾ Switch to Dark mode'}
          </button>
          <span style={{ fontSize: 13, color: theme.textMuted }}>
            Currently: {isDark ? 'Dark' : 'Light'}
          </span>
        </div>
      </div>
    </div>
  )
}
