import { useTheme } from '../../theme/ThemeContext'
import { useIsCompactLayout } from '../../theme/useIsCompactLayout'

interface Props {
  open: boolean
  toyTitle: string
  recipientUsername: string
  setRecipientUsername: (value: string) => void
  loading: boolean
  error: string | null
  onClose: () => void
  onSubmit: (username: string) => void
}

export function TransferModal({
  open,
  toyTitle,
  recipientUsername,
  setRecipientUsername,
  loading,
  error,
  onClose,
  onSubmit,
}: Props) {
  const { theme } = useTheme()
  const isCompactLayout = useIsCompactLayout()

  if (!open) {
    return null
  }

  const btnStyle: React.CSSProperties = {
    padding: '6px 14px',
    borderRadius: 6,
    border: `1px solid ${theme.border}`,
    background: theme.bg,
    color: theme.textPrimary,
    cursor: 'pointer',
    fontSize: 14,
  }

  const primaryBtnStyle: React.CSSProperties = {
    ...btnStyle,
    background: theme.ctaBg,
    color: theme.ctaText,
    border: 'none',
  }

  const inputStyle: React.CSSProperties = {
    padding: '7px 10px',
    borderRadius: 6,
    border: `1px solid ${theme.border}`,
    fontSize: 14,
    background: theme.inputBg,
    color: theme.textPrimary,
  }

  const labelStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    fontSize: 14,
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.32)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        zIndex: 300,
      }}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault()
          onSubmit(recipientUsername.trim())
        }}
        style={{
          width: '100%',
          maxWidth: 420,
          background: theme.surfaceAlt,
          border: `1px solid ${theme.border}`,
          borderRadius: 10,
          padding: isCompactLayout ? '18px 16px' : '18px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        <h3 style={{ margin: 0 }}>Transfer {toyTitle}</h3>
        <label style={labelStyle}>
          Recipient Username
          <input
            value={recipientUsername}
            onChange={(e) => setRecipientUsername(e.target.value)}
            style={inputStyle}
            placeholder="Enter username"
            autoFocus
          />
        </label>
        {error && <p style={{ margin: 0, color: theme.error, fontSize: 13 }}>{error}</p>}
        <div style={{ display: 'flex', gap: 8, flexDirection: isCompactLayout ? 'column' : 'row' }}>
          <button type="submit" disabled={loading} style={primaryBtnStyle}>
            {loading ? 'Starting…' : 'Start Transfer'}
          </button>
          <button type="button" onClick={onClose} style={btnStyle}>
            Close
          </button>
        </div>
      </form>
    </div>
  )
}