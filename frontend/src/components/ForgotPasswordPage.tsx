import { type FormEvent, useState } from 'react'
import { Link } from 'react-router-dom'
import { forgotPassword } from '../api/client'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const res = await forgotPassword(email)
      setMessage(res.message)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main style={{ maxWidth: 360, margin: '80px auto', padding: '0 16px' }}>
      <h1>Toy Library</h1>
      <h2>Forgot password</h2>
      {message ? (
        <>
          <p>{message}</p>
          <Link to="/login">Back to sign in</Link>
        </>
      ) : (
        <>
          <p>Enter your email address and we'll send you a link to reset your password.</p>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <label>
              Email
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                style={{ display: 'block', width: '100%', marginTop: 4 }}
              />
            </label>
            {error && <p style={{ color: 'red', margin: 0 }}>{error}</p>}
            <button type="submit" disabled={loading}>
              {loading ? 'Sending…' : 'Send reset link'}
            </button>
          </form>
          <p style={{ marginTop: 16 }}>
            <Link to="/login">Back to sign in</Link>
          </p>
        </>
      )}
    </main>
  )
}
