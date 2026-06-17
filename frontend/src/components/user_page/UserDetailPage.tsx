import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { fetchUserDetail, getProfile, sendUserContactEmail, UserDetail } from '../../api/client'
import { useTheme } from '../../theme/ThemeContext'
import styles from './UserDetailPage.module.css'

interface Props {
  token: string
}

export function UserDetailPage({ token }: Props) {
  const { theme } = useTheme()
  const { username } = useParams<{ username: string }>()
  const [user, setUser] = useState<UserDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false)
  const [emailMessage, setEmailMessage] = useState('')
  const [emailLoading, setEmailLoading] = useState(false)
  const [emailError, setEmailError] = useState<string | null>(null)
  const [emailSuccess, setEmailSuccess] = useState<string | null>(null)
  const [currentUsername, setCurrentUsername] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const fetchCurrentUser = async () => {
      try {
        const profile = await getProfile(token)
        if (!cancelled) {
          setCurrentUsername(profile.username)
        }
      } catch {
        // Keep email action visible if profile lookup fails; backend still enforces rules.
      }
    }

    void fetchCurrentUser()

    return () => {
      cancelled = true
    }
  }, [token])

  useEffect(() => {
    if (!username) return

    const fetchData = async () => {
      try {
        setLoading(true)
        setError(null)
        const userData = await fetchUserDetail(token, username)
        setUser(userData)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load user details')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [username, token])

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.loading} style={{ color: theme.textSecondary }}>Loading user details...</div>
      </div>
    )
  }

  if (error || !user) {
    return (
      <div className={styles.page}>
        <div
          className={styles.error}
          style={{ color: theme.error, borderColor: theme.error, background: 'transparent' }}
        >
          {error || 'User not found'}
        </div>
        <Link to="/users" className={styles.backLink} style={{ color: theme.link }}>
          ← Back to Users
        </Link>
      </div>
    )
  }

  const secondaryButtonStyle: React.CSSProperties = {
    padding: '7px 14px',
    borderRadius: 6,
    border: `1px solid ${theme.border}`,
    background: theme.bg,
    color: theme.textPrimary,
    cursor: 'pointer',
    fontSize: 14,
  }

  const primaryButtonStyle: React.CSSProperties = {
    ...secondaryButtonStyle,
    background: theme.ctaBg,
    color: theme.ctaText,
    border: 'none',
  }

  const openEmailModal = () => {
    setEmailSuccess(null)
    setEmailError(null)
    setIsEmailModalOpen(true)
  }

  const closeEmailModal = () => {
    if (emailLoading) return
    setIsEmailModalOpen(false)
    setEmailError(null)
  }

  const submitEmail = async () => {
    const trimmedMessage = emailMessage.trim()
    if (!trimmedMessage) {
      setEmailError('Please enter a message before sending.')
      return
    }

    try {
      setEmailLoading(true)
      setEmailError(null)
      await sendUserContactEmail(token, user.username, trimmedMessage)
      setEmailMessage('')
      setEmailSuccess(`Your email was sent to ${user.username}.`)
      setIsEmailModalOpen(false)
    } catch (err) {
      setEmailError(err instanceof Error ? err.message : 'Failed to send email')
    } finally {
      setEmailLoading(false)
    }
  }

  const isOwnProfile = currentUsername === user.username

  return (
    <div className={styles.page}>
      <Link to="/users" className={styles.backLink} style={{ color: theme.link }}>
        ← Back to Users
      </Link>

      <div className={styles.header} style={{ borderBottom: `2px solid ${theme.border}` }}>
        <div className={styles.nameSection}>
          <h1 style={{ color: theme.textPrimary }}>{user.username}</h1>
          {!isOwnProfile && (
            <button type="button" onClick={openEmailModal} style={secondaryButtonStyle}>
              Email
            </button>
          )}
        </div>
        {emailSuccess && <p className={styles.successMessage} style={{ color: theme.success }}>{emailSuccess}</p>}
      </div>

      <div
        className={styles.card}
        style={{ background: theme.surface, border: `1px solid ${theme.border}` }}
      >
        <div className={styles.detailItem} style={{ borderBottom: `1px solid ${theme.border}` }}>
          <span className={styles.label} style={{ color: theme.textSecondary }}>Neighborhood</span>
          <span className={styles.value} style={{ color: theme.textPrimary }}>{user.neighborhood || '—'}</span>
        </div>

        <div className={styles.detailItem}>
          <span className={styles.label} style={{ color: theme.textSecondary }}>Toys Owned</span>
          <Link
            to={`/toys?owner=${encodeURIComponent(user.username)}`}
            className={styles.link}
            style={{ color: theme.link }}
          >
            {user.toy_count} toys →
          </Link>
        </div>
      </div>

      {isEmailModalOpen && (
        <div className={styles.modalOverlay}>
          <form
            className={styles.modalCard}
            style={{ background: theme.surfaceAlt, border: `1px solid ${theme.border}` }}
            onSubmit={(e) => {
              e.preventDefault()
              void submitEmail()
            }}
          >
            <h2 style={{ margin: 0, color: theme.textPrimary }}>Email {user.username}</h2>
            <p className={styles.helperText} style={{ color: theme.textSecondary }}>
              You can use this message to start contact, then continue coordinating outside this app.
              We do not explicitly share contact details unless you include them in your message.
            </p>
            <label className={styles.messageLabel} style={{ color: theme.textPrimary }}>
              Message
              <textarea
                value={emailMessage}
                onChange={(e) => setEmailMessage(e.target.value)}
                className={styles.messageInput}
                style={{ background: theme.inputBg, color: theme.textPrimary, borderColor: theme.border }}
                placeholder="Write your message here..."
                maxLength={2000}
                autoFocus
              />
            </label>
            {emailError && <p className={styles.modalError} style={{ color: theme.error }}>{emailError}</p>}
            <div className={styles.modalActions}>
              <button type="submit" disabled={emailLoading} style={primaryButtonStyle}>
                {emailLoading ? 'Sending…' : 'Send'}
              </button>
              <button type="button" onClick={closeEmailModal} disabled={emailLoading} style={secondaryButtonStyle}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
