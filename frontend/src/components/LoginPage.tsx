import { type FormEvent, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { login, register, TOKEN_KEY } from '../api/client'

type Mode = 'login' | 'register'

interface Props {
  onLogin: () => void
}

export default function LoginPage({ onLogin }: Props) {
  const [mode, setMode] = useState<Mode>('login')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [registered, setRegistered] = useState(false)
  const navigate = useNavigate()

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      if (mode === 'register') {
        await register(username, email, password)
        setRegistered(true)
        return
      }
      const token = await login(username, password)
      sessionStorage.setItem(TOKEN_KEY, token)
      onLogin()
      navigate('/', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  function toggleMode() {
    setMode((m) => (m === 'login' ? 'register' : 'login'))
    setError(null)
    setRegistered(false)
  }

  if (registered) {
    return (
      <main style={{ maxWidth: 360, margin: '80px auto', padding: '0 16px' }}>
        <h1>Toy Library</h1>
        <h2>Check your email</h2>
        <p>
          A verification link has been sent to <strong>{email}</strong>. Please
          click the link to activate your account before signing in.
        </p>
        <button type="button" onClick={toggleMode} style={{ background: 'none', border: 'none', color: 'blue', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}>
          Back to sign in
        </button>
        <p style={{ marginTop: 12 }}>
          Didn't receive it?{' '}
          <Link to="/resend-verification">Resend verification email</Link>
        </p>
      </main>
    )
  }

  return (
    <main style={{ maxWidth: 360, margin: '80px auto', padding: '0 16px' }}>
      <h1>Toy Library</h1>
      <h2>{mode === 'login' ? 'Sign in' : 'Create account'}</h2>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <label>
          Username
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            autoComplete="username"
            style={{ display: 'block', width: '100%', marginTop: 4 }}
          />
        </label>
        {mode === 'register' && (
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
        )}
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            style={{ display: 'block', width: '100%', marginTop: 4 }}
          />
        </label>
        {error && (
          <>
            <p style={{ color: 'red', margin: 0 }}>{error}</p>
            {error.toLowerCase().includes('not verified') && (
              <p style={{ margin: 0 }}>
                <Link to="/resend-verification">Resend verification email</Link>
              </p>
            )}
          </>
        )}
        <button type="submit" disabled={loading}>
          {loading ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Register'}
        </button>
      </form>
      <p style={{ marginTop: 16 }}>
        {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
        <button type="button" onClick={toggleMode} style={{ background: 'none', border: 'none', color: 'blue', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}>
          {mode === 'login' ? 'Register' : 'Sign in'}
        </button>
      </p>
      {mode === 'login' && (
        <p style={{ marginTop: 8 }}>
          <Link to="/forgot-password">Forgot password?</Link>
        </p>
      )}
    </main>
  )
}
