import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { fetchUserDetail, UserDetail } from '../api/client'
import { useTheme } from '../theme/ThemeContext'
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

  return (
    <div className={styles.page}>
      <Link to="/users" className={styles.backLink} style={{ color: theme.link }}>
        ← Back to Users
      </Link>

      <div className={styles.header} style={{ borderBottom: `2px solid ${theme.border}` }}>
        <div className={styles.nameSection}>
          <h1 style={{ color: theme.textPrimary }}>{user.username}</h1>
          {user.is_email_verified && <span className={styles.verifiedBadge}>✓ Verified</span>}
        </div>
      </div>

      <div
        className={styles.card}
        style={{ background: theme.surface, border: `1px solid ${theme.border}` }}
      >
        <div className={styles.detailItem} style={{ borderBottom: `1px solid ${theme.border}` }}>
          <span className={styles.label} style={{ color: theme.textSecondary }}>Email</span>
          <span className={styles.value} style={{ color: theme.textPrimary }}>{user.email}</span>
        </div>

        <div className={styles.detailItem} style={{ borderBottom: `1px solid ${theme.border}` }}>
          <span className={styles.label} style={{ color: theme.textSecondary }}>Neighborhood</span>
          <span className={styles.value} style={{ color: theme.textPrimary }}>{user.neighborhood || '—'}</span>
        </div>

        <div className={styles.detailItem} style={{ borderBottom: `1px solid ${theme.border}` }}>
          <span className={styles.label} style={{ color: theme.textSecondary }}>Toys Owned</span>
          <Link
            to={`/toys?owner=${encodeURIComponent(user.username)}`}
            className={styles.link}
            style={{ color: theme.link }}
          >
            {user.toy_count} toys →
          </Link>
        </div>

        <div className={styles.detailItem}>
          <span className={styles.label} style={{ color: theme.textSecondary }}>Email Verified</span>
          <span className={styles.value} style={{ color: theme.textPrimary }}>{user.is_email_verified ? 'Yes' : 'No'}</span>
        </div>
      </div>
    </div>
  )
}
