import { useEffect, useState } from 'react'
import {
  addAllowlistEmail,
  getAllowlist,
  removeAllowlistEmail,
  triggerToyEmbedding,
} from '../api/client'
import { useTheme } from '../theme/ThemeContext'
import { useIsCompactLayout } from '../theme/useIsCompactLayout'

interface Props {
  token: string
}

export default function AdminPage({ token }: Props) {
  const { theme } = useTheme()
  const isCompactLayout = useIsCompactLayout()

  const [emails, setEmails] = useState<string[]>([])
  const [loadingList, setLoadingList] = useState(true)
  const [listError, setListError] = useState<string | null>(null)

  const [newEmail, setNewEmail] = useState('')
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)

  const [removingEmail, setRemovingEmail] = useState<string | null>(null)
  const [removeError, setRemoveError] = useState<string | null>(null)

  const [toyId, setToyId] = useState('')
  const [triggering, setTriggering] = useState(false)
  const [triggerSuccess, setTriggerSuccess] = useState<string | null>(null)
  const [triggerError, setTriggerError] = useState<string | null>(null)

  useEffect(() => {
    getAllowlist(token)
      .then((res) => {
        setEmails(res.emails)
        setLoadingList(false)
      })
      .catch((err: unknown) => {
        setListError(err instanceof Error ? err.message : 'Failed to load allowlist')
        setLoadingList(false)
      })
  }, [token])

  async function handleAddEmail() {
    const trimmed = newEmail.trim()
    if (!trimmed) {
      return
    }
    setAdding(true)
    setAddError(null)
    try {
      const res = await addAllowlistEmail(token, trimmed)
      setEmails(res.emails)
      setNewEmail('')
    } catch (err: unknown) {
      setAddError(err instanceof Error ? err.message : 'Failed to add email')
    } finally {
      setAdding(false)
    }
  }

  async function handleRemoveEmail(email: string) {
    setRemovingEmail(email)
    setRemoveError(null)
    try {
      await removeAllowlistEmail(token, email)
      setEmails((current) => current.filter((e) => e !== email))
    } catch (err: unknown) {
      setRemoveError(err instanceof Error ? err.message : 'Failed to remove email')
    } finally {
      setRemovingEmail(null)
    }
  }

  async function handleTriggerEmbedding() {
    const parsed = Number(toyId)
    if (!toyId.trim() || !Number.isInteger(parsed)) {
      setTriggerError('Enter a valid toy ID (whole number).')
      setTriggerSuccess(null)
      return
    }
    setTriggering(true)
    setTriggerError(null)
    setTriggerSuccess(null)
    try {
      await triggerToyEmbedding(token, parsed)
      setTriggerSuccess(`Embedding job queued for toy ${parsed}.`)
    } catch (err: unknown) {
      setTriggerError(err instanceof Error ? err.message : 'Failed to trigger embedding')
    } finally {
      setTriggering(false)
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

  const buttonStyle: React.CSSProperties = {
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

  const rowStyle: React.CSSProperties = {
    display: 'flex',
    gap: 10,
    alignItems: isCompactLayout ? 'stretch' : 'center',
    flexDirection: isCompactLayout ? 'column' : 'row',
  }

  return (
    <div style={{ padding: isCompactLayout ? 16 : 40, maxWidth: 640 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 32 }}>Admin</h1>

      {/* Allowlist */}
      <div style={sectionStyle}>
        <label style={labelStyle}>Allowlisted emails</label>

        {loadingList ? (
          <p style={{ color: theme.textMuted, fontSize: 14 }}>Loading…</p>
        ) : listError ? (
          <p style={{ color: theme.error, fontSize: 13 }}>{listError}</p>
        ) : emails.length === 0 ? (
          <p style={{ color: theme.textMuted, fontSize: 14 }}>No emails on the allowlist yet.</p>
        ) : (
          <ul style={{ listStyle: 'none', margin: '0 0 16px 0', padding: 0 }}>
            {emails.map((email) => (
              <li
                key={email}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 10,
                  padding: '8px 0',
                  borderBottom: `1px solid ${theme.border}`,
                }}
              >
                <span style={{ fontSize: 14, wordBreak: 'break-all' }}>{email}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveEmail(email)}
                  disabled={removingEmail === email}
                  style={{
                    padding: '4px 12px',
                    background: 'none',
                    border: `1px solid ${theme.border}`,
                    borderRadius: 6,
                    cursor: removingEmail === email ? 'not-allowed' : 'pointer',
                    fontSize: 13,
                    color: theme.textSecondary,
                    flexShrink: 0,
                  }}
                >
                  {removingEmail === email ? 'Removing…' : 'Remove'}
                </button>
              </li>
            ))}
          </ul>
        )}
        {removeError && (
          <p style={{ color: theme.error, fontSize: 13, marginBottom: 12 }}>{removeError}</p>
        )}

        <div style={rowStyle}>
          <input
            style={inputStyle}
            type="email"
            placeholder="name@example.com"
            value={newEmail}
            onChange={(e) => {
              setNewEmail(e.target.value)
              setAddError(null)
            }}
            disabled={adding}
          />
          <button
            style={{ ...buttonStyle, opacity: adding ? 0.6 : 1 }}
            onClick={handleAddEmail}
            disabled={adding}
          >
            {adding ? 'Adding…' : 'Add email'}
          </button>
        </div>
        {addError && <p style={{ color: theme.error, fontSize: 13, marginTop: 6 }}>{addError}</p>}
      </div>

      {/* Trigger embedding */}
      <div style={{ ...sectionStyle, borderBottom: 'none', marginBottom: 0, paddingBottom: 0 }}>
        <label style={labelStyle}>Rerun toy embedding</label>
        <div style={rowStyle}>
          <input
            style={inputStyle}
            type="number"
            placeholder="Toy ID"
            value={toyId}
            onChange={(e) => {
              setToyId(e.target.value)
              setTriggerError(null)
              setTriggerSuccess(null)
            }}
            disabled={triggering}
          />
          <button
            style={{ ...buttonStyle, opacity: triggering ? 0.6 : 1 }}
            onClick={handleTriggerEmbedding}
            disabled={triggering}
          >
            {triggering ? 'Triggering…' : 'Trigger'}
          </button>
        </div>
        {triggerSuccess && (
          <p style={{ color: theme.success, fontSize: 13, marginTop: 6 }}>{triggerSuccess}</p>
        )}
        {triggerError && (
          <p style={{ color: theme.error, fontSize: 13, marginTop: 6 }}>{triggerError}</p>
        )}
      </div>
    </div>
  )
}
