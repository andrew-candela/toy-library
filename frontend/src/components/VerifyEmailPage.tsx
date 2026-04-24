import { type FormEvent, useEffect, useState, useRef } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { verifyEmail, resendVerification } from '../api/client'

type Status = 'loading' | 'success' | 'error'

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams()
  const [status, setStatus] = useState<Status>('loading')
  const [message, setMessage] = useState('')
  const hasFetched = useRef(false)


  // Resend form state
  const [resendEmail, setResendEmail] = useState('')
  const [resendLoading, setResendLoading] = useState(false)
  const [resendMessage, setResendMessage] = useState<string | null>(null)

  useEffect(() => {
    const token = searchParams.get('token')
    if (!token) {
      setStatus('error')
      setMessage('No verification token was provided.')
      return
    }
    
    if (hasFetched.current) return   // <-- guard
    hasFetched.current = true
    
    verifyEmail(token)
      .then((res) => {
        setStatus('success')
        setMessage(res.message)
      })
      .catch((err) => {
        setStatus('error')
        setMessage(err instanceof Error ? err.message : 'Verification failed.')
      })
  }, [searchParams])

  async function handleResend(e: FormEvent) {
    e.preventDefault()
    setResendLoading(true)
    setResendMessage(null)
    try {
      const res = await resendVerification(resendEmail)
      setResendMessage(res.message)
    } catch (err) {
      setResendMessage(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setResendLoading(false)
    }
  }

  return (
    <main style={{ maxWidth: 360, margin: '80px auto', padding: '0 16px' }}>
      <h1>Toy Library</h1>
      <h2>Email Verification</h2>
      {status === 'loading' && <p>Verifying your email…</p>}
      {status === 'success' && (
        <>
          <p style={{ color: 'green' }}>{message}</p>
          <Link to="/login">Go to sign in</Link>
        </>
      )}
      {status === 'error' && (
        <>
          <p style={{ color: 'red' }}>{message}</p>
          <h3 style={{ marginTop: 24 }}>Request a new link</h3>
          {resendMessage ? (
            <p>{resendMessage}</p>
          ) : (
            <form onSubmit={handleResend} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <label>
                Email
                <input
                  type="email"
                  value={resendEmail}
                  onChange={(e) => setResendEmail(e.target.value)}
                  required
                  autoComplete="email"
                  style={{ display: 'block', width: '100%', marginTop: 4 }}
                />
              </label>
              <button type="submit" disabled={resendLoading}>
                {resendLoading ? 'Sending…' : 'Resend verification email'}
              </button>
            </form>
          )}
        </>
      )}
    </main>
  )
}
