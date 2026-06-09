import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  cancelTransfer,
  fetchInterests,
  fetchMyToys,
  fetchToy,
  initiateTransfer,
  type InterestDetail,
  type Toy,
} from '../api/client'
import { useTheme } from '../theme/ThemeContext'
import { TransferModal } from './toy_page/TransferModal'

interface Props {
  token: string
}

export default function ToyDetailPage({ token }: Props) {
  const { id } = useParams<{ id: string }>()
  const [toy, setToy] = useState<Toy | null>(null)
  const [interestDetail, setInterestDetail] = useState<InterestDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [transferToy, setTransferToy] = useState<Toy | null>(null)
  const [transferUsername, setTransferUsername] = useState('')
  const [transferError, setTransferError] = useState<string | null>(null)
  const [transferLoading, setTransferLoading] = useState(false)
  const [pendingTransferTo, setPendingTransferTo] = useState<string | null>(null)
  const [pendingTransferError, setPendingTransferError] = useState<string | null>(null)
  const [cancelTransferLoading, setCancelTransferLoading] = useState(false)
  const { theme } = useTheme()

  useEffect(() => {
    if (!id) return

    setLoading(true)
    setError(null)

    Promise.all([
      fetchToy(token, Number(id)),
      fetchInterests(token, Number(id)),
      fetchMyToys(token),
    ])
      .then(([toyData, interestData, myToys]) => {
        const myToyRecord = myToys.find((userToy) => userToy.toy_id === Number(id))
        setToy(toyData)
        setInterestDetail(interestData)
        setPendingTransferTo(myToyRecord?.pending_user?.username ?? null)
        setPendingTransferError(null)
      })
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : 'Failed to load toy'),
      )
      .finally(() => setLoading(false))
  }, [token, id])

  function openTransferModal(username: string) {
    if (!toy || pendingTransferTo) return
    setTransferToy(toy)
    setTransferUsername(username)
    setTransferError(null)
  }

  function closeTransferModal() {
    setTransferToy(null)
    setTransferUsername('')
    setTransferError(null)
    setTransferLoading(false)
  }

  async function handleTransferSubmit(username: string) {
    if (!transferToy) return
    setTransferLoading(true)
    setTransferError(null)

    try {
      await initiateTransfer(token, transferToy.id, username)
      setPendingTransferTo(username)
      setPendingTransferError(null)
      closeTransferModal()
    } catch (err: unknown) {
      setTransferError(err instanceof Error ? err.message : 'Failed to initiate transfer')
    } finally {
      setTransferLoading(false)
    }
  }

  async function handleCancelPendingTransfer() {
    if (!toy) return
    setCancelTransferLoading(true)
    setPendingTransferError(null)

    try {
      await cancelTransfer(token, toy.id)
      setPendingTransferTo(null)
    } catch (err: unknown) {
      setPendingTransferError(
        err instanceof Error ? err.message : 'Failed to cancel transfer',
      )
    } finally {
      setCancelTransferLoading(false)
    }
  }

  const chipStyle: React.CSSProperties = {
    display: 'inline-block',
    padding: '3px 10px',
    borderRadius: 12,
    background: theme.chipBg,
    color: theme.chipText,
    fontSize: 13,
    fontWeight: 500,
  }

  const labelStyle: React.CSSProperties = {
    fontSize: 13,
    color: theme.textMuted,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: 4,
  }

  return (
    <main style={{ padding: '40px 32px', maxWidth: 720 }}>
      <Link
        to="/toys"
        style={{ fontSize: 14, color: theme.link, textDecoration: 'none', display: 'inline-block', marginBottom: 24 }}
      >
        ← Back to Toys
      </Link>

      {loading && <p style={{ color: theme.textMuted }}>Loading…</p>}
      {error && <p style={{ color: theme.error }}>{error}</p>}

      {toy && (
        <>
          <div style={{ display: 'flex', gap: 32, alignItems: 'flex-start', marginBottom: 32 }}>
            {toy.image_url && (
              <img
                src={toy.image_url}
                alt={toy.title}
                style={{ width: 180, height: 180, objectFit: 'cover', borderRadius: 10, border: `1px solid ${theme.border}`, flexShrink: 0 }}
              />
            )}
            <div style={{ flex: 1 }}>
              <h1 style={{ margin: '0 0 8px 0' }}>{toy.title}</h1>

              {toy.age_range && (
                <div style={{ marginBottom: 12 }}>
                  <div style={labelStyle}>Age Range</div>
                  <span style={{ fontSize: 15 }}>{toy.age_range}</span>
                </div>
              )}

              {toy.description && (
                <div style={{ marginBottom: 12 }}>
                  <div style={labelStyle}>Description</div>
                  <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6, color: theme.textSecondary }}>{toy.description}</p>
                </div>
              )}

              {toy.tags.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div style={labelStyle}>Tags</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {toy.tags.map((tag) => (
                      <span key={tag} style={chipStyle}>#{tag}</span>
                    ))}
                  </div>
                </div>
              )}

              {interestDetail && (
                <div style={{ marginBottom: 16 }}>
                  <div style={labelStyle}>Interested Users</div>
                  {pendingTransferTo && (
                    <div
                      style={{
                        marginBottom: 10,
                        padding: '10px 12px',
                        borderRadius: 8,
                        border: `1px solid ${theme.border}`,
                        background: theme.surfaceAlt,
                        display: 'flex',
                        flexWrap: 'wrap',
                        alignItems: 'center',
                        gap: 8,
                      }}
                    >
                      <span style={{ color: theme.textSecondary, fontSize: 14 }}>
                        Pending transfer to <strong>{pendingTransferTo}</strong>
                      </span>
                      <button
                        type="button"
                        onClick={handleCancelPendingTransfer}
                        disabled={cancelTransferLoading}
                        style={{
                          padding: '4px 10px',
                          borderRadius: 6,
                          border: `1px solid ${theme.border}`,
                          background: theme.bg,
                          color: theme.textPrimary,
                          cursor: 'pointer',
                          fontSize: 13,
                        }}
                      >
                        {cancelTransferLoading ? 'Canceling…' : 'Cancel Transfer'}
                      </button>
                    </div>
                  )}
                  {pendingTransferError && (
                    <p style={{ margin: '0 0 10px 0', color: theme.error, fontSize: 13 }}>
                      {pendingTransferError}
                    </p>
                  )}
                  <div
                    style={{
                      ...chipStyle,
                      background: theme.surface,
                      border: `1px solid ${theme.border}`,
                      color: theme.textSecondary,
                      marginBottom: interestDetail.can_view_usernames ? 10 : 0,
                    }}
                  >
                    {interestDetail.interested_count} interested
                  </div>

                  {interestDetail.can_view_usernames && (
                    interestDetail.interested_usernames.length > 0 ? (
                      <>
                        <p style={{ margin: '0 0 8px 0', color: theme.textMuted, fontSize: 14 }}>
                          {pendingTransferTo
                            ? 'Cancel the pending transfer before starting a new one.'
                            : 'Click a username to start a transfer to that interested user.'}
                        </p>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {interestDetail.interested_usernames.map((username) => (
                            <button
                              key={username}
                              type="button"
                              onClick={() => openTransferModal(username)}
                              style={{
                                ...chipStyle,
                                border: 'none',
                                cursor: pendingTransferTo ? 'not-allowed' : 'pointer',
                                opacity: pendingTransferTo ? 0.7 : 1,
                              }}
                              title={`Start a transfer to ${username}`}
                              disabled={Boolean(pendingTransferTo)}
                            >
                              {username}
                            </button>
                          ))}
                        </div>
                      </>
                    ) : (
                      <p style={{ margin: 0, color: theme.textMuted, fontSize: 14 }}>
                        No users have expressed interest yet.
                      </p>
                    )
                  )}
                </div>
              )}

            </div>
          </div>

          <TransferModal
            open={Boolean(transferToy)}
            toyTitle={transferToy?.title ?? ''}
            recipientUsername={transferUsername}
            setRecipientUsername={setTransferUsername}
            loading={transferLoading}
            error={transferError}
            onClose={closeTransferModal}
            onSubmit={handleTransferSubmit}
          />
        </>
      )}
    </main>
  )
}
