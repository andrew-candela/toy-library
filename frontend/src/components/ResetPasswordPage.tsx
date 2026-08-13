import { type FormEvent, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { resetPassword } from '../api/client'
import { useTheme } from '../theme/ThemeContext'

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') ?? ''
  const { theme } = useTheme()

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    if (!token) {
      setError('No reset token found. Please use the link from your email.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await resetPassword(token, newPassword)
      setMessage(res.message)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  if (message) {
    return (
      <main style={{ maxWidth: 360, margin: '80px auto', padding: '0 16px' }}>
        <h1>Toy Library</h1>
        <h2>Password reset</h2>
        <p style={{ color: theme.success }}>{message}</p>
        <Link to="/login">Go to sign in</Link>
      </main>
    )
  }

  return (
    <main style={{ maxWidth: 360, margin: '80px auto', padding: '0 16px' }}>
      <h1>Toy Library</h1>
      <h2>Reset your password</h2>
      {!token && (
        <p style={{ color: theme.error }}>
          No reset token found. Please use the link from your email.
        </p>
      )}
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <label>
          New password
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            autoComplete="new-password"
            style={{
              display: 'block',
              width: '100%',
              marginTop: 4,
              background: theme.inputBg,
              color: theme.textPrimary,
              border: `1px solid ${theme.inputBorder}`,
              borderRadius: 4,
              padding: '6px 8px',
            }}
          />
        </label>
        <label>
          Confirm new password
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            autoComplete="new-password"
            style={{
              display: 'block',
              width: '100%',
              marginTop: 4,
              background: theme.inputBg,
              color: theme.textPrimary,
              border: `1px solid ${theme.inputBorder}`,
              borderRadius: 4,
              padding: '6px 8px',
            }}
          />
        </label>
        {error && <p style={{ color: theme.error, margin: 0 }}>{error}</p>}
        <button type="submit" disabled={loading || !token}>
          {loading ? 'Resetting…' : 'Reset password'}
        </button>
      </form>
    </main>
  )
}
