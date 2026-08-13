import { useEffect, useRef, useState } from 'react'
import { fetchUsernameSuggestions } from '../../api/client'
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
  token: string
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
  token,
}: Props) {
  const { theme } = useTheme()
  const isCompactLayout = useIsCompactLayout()

  const [suggestions, setSuggestions] = useState<string[]>([])
  const [suggestionsLoading, setSuggestionsLoading] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Set right before setRecipientUsername() is called as a result of picking
  // a suggestion, so the resulting debounced re-fetch (triggered by the
  // recipientUsername change) skips itself instead of popping the dropdown
  // back open once it resolves.
  const skipNextFetchRef = useRef(false)

  // Don't let a pre-filled username (e.g. from clicking an interested user)
  // immediately pop the suggestions dropdown when the modal opens.
  useEffect(() => {
    if (open) {
      setSuggestions([])
      setShowSuggestions(false)
    }
  }, [open])

  useEffect(() => {
    if (skipNextFetchRef.current) {
      skipNextFetchRef.current = false
      return
    }

    const query = recipientUsername.trim()
    if (!open || !query) {
      setSuggestions([])
      setSuggestionsLoading(false)
      return
    }

    let cancelled = false
    setSuggestionsLoading(true)
    const timer = setTimeout(() => {
      fetchUsernameSuggestions(token, query)
        .then((usernames) => {
          if (!cancelled) {
            setSuggestions(usernames)
            setShowSuggestions(true)
          }
        })
        .catch(() => {
          if (!cancelled) {
            setSuggestions([])
          }
        })
        .finally(() => {
          if (!cancelled) {
            setSuggestionsLoading(false)
          }
        })
    }, 400)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [recipientUsername, token, open])

  function selectSuggestion(username: string) {
    if (blurTimeoutRef.current) {
      clearTimeout(blurTimeoutRef.current)
      blurTimeoutRef.current = null
    }
    skipNextFetchRef.current = true
    setSuggestions([])
    setRecipientUsername(username)
    setShowSuggestions(false)
  }

  function handleInputBlur() {
    blurTimeoutRef.current = setTimeout(() => {
      setShowSuggestions(false)
    }, 150)
  }

  function handleInputFocus() {
    if (suggestions.length > 0) {
      setShowSuggestions(true)
    }
  }

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
          <div style={{ position: 'relative' }}>
            <input
              name="recipient-search"
              value={recipientUsername}
              onChange={(e) => setRecipientUsername(e.target.value)}
              onFocus={handleInputFocus}
              onBlur={handleInputBlur}
              style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }}
              placeholder="Enter username"
              autoFocus
              autoComplete="off"
            />
            {showSuggestions && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  marginTop: 4,
                  maxHeight: 180,
                  overflowY: 'auto',
                  background: theme.surfaceAlt,
                  border: `1px solid ${theme.border}`,
                  borderRadius: 6,
                  zIndex: 10,
                  boxShadow: '0 4px 10px rgba(0,0,0,0.15)',
                }}
              >
                {suggestions.map((username) => (
                  <div
                    key={username}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => selectSuggestion(username)}
                    style={{
                      padding: '7px 10px',
                      cursor: 'pointer',
                      fontSize: 14,
                    }}
                  >
                    {username}
                  </div>
                ))}
                {!suggestionsLoading && suggestions.length === 0 && (
                  <div style={{ padding: '7px 10px', fontSize: 13, color: theme.textSecondary }}>
                    No matching users
                  </div>
                )}
              </div>
            )}
          </div>
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
