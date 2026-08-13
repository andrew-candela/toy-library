import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  acceptTransfer,
  appendToyFormFields,
  cancelTransfer,
  deleteInterest,
  deleteToy,
  expressInterest,
  fetchAllInterests,
  fetchInterests,
  fetchMyToys,
  fetchPendingIncoming,
  fetchToy,
  initiateTransfer,
  updateToy,
  type InterestDetail,
  type Toy,
} from '../api/client'
import { compressImage } from '../lib/imageCompression'
import { useTheme } from '../theme/ThemeContext'
import { useIsCompactLayout } from '../theme/useIsCompactLayout'
import { ToyFormModal } from './toy_page/ToyFormModal'
import { TransferModal } from './toy_page/TransferModal'
import type { ToyFormData } from './toy_page/useToysPage'
import { useToyImage } from './useToyImage'

interface Props {
  token: string
}

const emptyForm: ToyFormData = {
  title: '',
  description: '',
  min_age: '',
  max_age: '',
  image_path: '',
  image_file: null,
  image_preview_url: null,
  tags: [],
}

export default function ToyDetailPage({ token }: Props) {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
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

  // Ownership / interest / incoming-transfer metadata for the action buttons.
  const [isOwner, setIsOwner] = useState(false)
  const [isPendingRecipient, setIsPendingRecipient] = useState(false)
  const [hasExpressedInterest, setHasExpressedInterest] = useState(false)
  const [interestActionLoading, setInterestActionLoading] = useState(false)
  const [acceptTransferLoading, setAcceptTransferLoading] = useState(false)
  const [showTransferAcceptedMessage, setShowTransferAcceptedMessage] = useState(false)

  // Edit form modal state.
  const [formOpen, setFormOpen] = useState(false)
  const [formData, setFormData] = useState<ToyFormData>(emptyForm)
  const [formError, setFormError] = useState<string | null>(null)
  const [formLoading, setFormLoading] = useState(false)
  const [imageCompressing, setImageCompressing] = useState(false)

  const { theme } = useTheme()
  const isCompactLayout = useIsCompactLayout()
  const { imageSrc } = useToyImage(token, toy?.image_path ?? null)

  const refreshAll = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError(null)

    try {
      const [toyData, interestData, myToys, allInterests, pendingIncoming] = await Promise.all([
        fetchToy(token, Number(id)),
        fetchInterests(token, Number(id)),
        fetchMyToys(token),
        fetchAllInterests(token),
        fetchPendingIncoming(token),
      ])

      const myToyRecord = myToys.find((userToy) => userToy.toy_id === Number(id))
      const interestSummary = allInterests.find((summary) => summary.toy_id === Number(id))

      setToy(toyData)
      setInterestDetail(interestData)
      setPendingTransferTo(myToyRecord?.pending_user?.username ?? null)
      setPendingTransferError(null)
      setIsOwner(Boolean(myToyRecord))
      setIsPendingRecipient(pendingIncoming.some((userToy) => userToy.toy_id === Number(id)))
      setHasExpressedInterest(interestSummary?.viewer_interested ?? false)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load toy')
    } finally {
      setLoading(false)
    }
  }, [token, id])

  useEffect(() => {
    void refreshAll()
  }, [refreshAll])

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

  function formatRelativeTime(isoTimestamp: string): string {
    const date = new Date(isoTimestamp)
    if (Number.isNaN(date.getTime())) {
      return 'Unknown time'
    }

    const diffMs = Date.now() - date.getTime()
    if (diffMs < 0) {
      return 'just now'
    }

    const minutes = Math.floor(diffMs / (1000 * 60))
    if (minutes < 1) return 'just now'
    if (minutes < 60) return `${minutes}m ago`

    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h ago`

    const days = Math.floor(hours / 24)
    if (days < 7) return `${days}d ago`

    const weeks = Math.floor(days / 7)
    if (weeks < 5) return `${weeks}w ago`

    const months = Math.floor(days / 30)
    if (months < 12) return `${months}mo ago`

    const years = Math.floor(days / 365)
    return `${years}y ago`
  }

  function formatAbsoluteLocalTime(isoTimestamp: string): string {
    const date = new Date(isoTimestamp)
    if (Number.isNaN(date.getTime())) {
      return 'Unknown date'
    }

    return date.toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    })
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
      setPendingTransferError(err instanceof Error ? err.message : 'Failed to cancel transfer')
    } finally {
      setCancelTransferLoading(false)
    }
  }

  async function handleExpressInterest() {
    if (!toy || interestActionLoading) return
    setInterestActionLoading(true)
    setError(null)
    try {
      await expressInterest(token, toy.id)
      setHasExpressedInterest(true)
      setInterestDetail((prev) =>
        prev ? { ...prev, interested_count: prev.interested_count + 1 } : prev,
      )
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to express interest')
    } finally {
      setInterestActionLoading(false)
    }
  }

  async function handleCancelInterest() {
    if (!toy || interestActionLoading) return
    setInterestActionLoading(true)
    setError(null)
    try {
      await deleteInterest(token, toy.id)
      setHasExpressedInterest(false)
      setInterestDetail((prev) =>
        prev ? { ...prev, interested_count: Math.max(0, prev.interested_count - 1) } : prev,
      )
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to cancel interest')
    } finally {
      setInterestActionLoading(false)
    }
  }

  async function handleAcceptTransferOnDetail() {
    if (!toy || acceptTransferLoading) return
    setAcceptTransferLoading(true)
    setError(null)
    try {
      await acceptTransfer(token, toy.id)
      await refreshAll()
      setShowTransferAcceptedMessage(true)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to accept transfer')
    } finally {
      setAcceptTransferLoading(false)
    }
  }

  function openEdit() {
    if (!toy) return
    setFormData({
      title: toy.title,
      description: toy.description ?? '',
      min_age: toy.min_age?.toString() ?? '',
      max_age: toy.max_age?.toString() ?? '',
      image_path: toy.image_path ?? '',
      image_file: null,
      image_preview_url: null,
      tags: [...toy.tags],
    })
    setFormError(null)
    setFormOpen(true)
  }

  function closeForm() {
    setFormOpen(false)
    setFormError(null)
    if (formData.image_preview_url?.startsWith('blob:')) {
      URL.revokeObjectURL(formData.image_preview_url)
    }
    setFormData(emptyForm)
  }

  function handleFormChange(
    field: keyof Omit<ToyFormData, 'tags' | 'image_file' | 'image_preview_url'>,
    value: string,
  ) {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  async function handleImageFileChange(file: File | null) {
    if (!file) {
      setFormData((prev) => {
        if (prev.image_preview_url?.startsWith('blob:')) {
          URL.revokeObjectURL(prev.image_preview_url)
        }
        return { ...prev, image_file: null, image_preview_url: null }
      })
      return
    }

    setImageCompressing(true)
    try {
      const compressedFile = await compressImage(file)
      setFormData((prev) => {
        if (prev.image_preview_url?.startsWith('blob:')) {
          URL.revokeObjectURL(prev.image_preview_url)
        }
        return {
          ...prev,
          image_file: compressedFile,
          image_preview_url: URL.createObjectURL(compressedFile),
        }
      })
    } finally {
      setImageCompressing(false)
    }
  }

  async function handleFormSubmit() {
    if (!toy) return
    setFormLoading(true)
    setFormError(null)
    try {
      const payload = new FormData()
      appendToyFormFields(payload, {
        title: formData.title,
        description: formData.description || undefined,
        min_age: formData.min_age !== '' ? Number(formData.min_age) : undefined,
        max_age: formData.max_age !== '' ? Number(formData.max_age) : undefined,
        tags: formData.tags,
      })
      if (formData.image_file) {
        payload.append('image_file', formData.image_file)
      }

      const updated = await updateToy(token, toy.id, payload)
      setToy(updated)
      closeForm()
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setFormLoading(false)
    }
  }

  async function handleDeleteToy() {
    if (!toy) return
    if (!window.confirm(`Delete "${toy.title}"?`)) return
    try {
      await deleteToy(token, toy.id)
      navigate('/toys', { replace: true })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Delete failed')
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

  return (
    <main style={{ padding: isCompactLayout ? '24px 16px' : '40px 32px', maxWidth: 720 }}>
      <Link
        to="/toys"
        style={{
          fontSize: 14,
          color: theme.link,
          textDecoration: 'none',
          display: 'inline-block',
          marginBottom: 24,
        }}
      >
        ← Back to Toys
      </Link>

      {loading && <p style={{ color: theme.textMuted }}>Loading…</p>}
      {error && <p style={{ color: theme.error }}>{error}</p>}

      {toy && (
        <>
          {showTransferAcceptedMessage && (
            <div
              style={{
                marginBottom: 20,
                padding: '12px 14px',
                borderRadius: 8,
                border: `1px solid ${theme.border}`,
                background: theme.surfaceAlt,
                display: 'flex',
                flexDirection: isCompactLayout ? 'column' : 'row',
                alignItems: isCompactLayout ? 'flex-start' : 'center',
                justifyContent: 'space-between',
                gap: 10,
              }}
            >
              <span style={{ fontSize: 14, color: theme.textSecondary }}>
                You have accepted the transfer of <strong>{toy.title}</strong>. You are now the
                owner of this toy.
              </span>
              <button
                type="button"
                onClick={() => setShowTransferAcceptedMessage(false)}
                style={{
                  padding: '4px 10px',
                  borderRadius: 6,
                  border: `1px solid ${theme.border}`,
                  background: theme.bg,
                  color: theme.textPrimary,
                  cursor: 'pointer',
                  fontSize: 13,
                  width: isCompactLayout ? '100%' : undefined,
                }}
              >
                Dismiss
              </button>
            </div>
          )}

          <div
            style={{
              display: 'flex',
              flexDirection: isCompactLayout ? 'column' : 'row',
              gap: isCompactLayout ? 20 : 32,
              alignItems: 'flex-start',
              marginBottom: 32,
            }}
          >
            {imageSrc && (
              <img
                src={imageSrc}
                alt={toy.title}
                style={{
                  width: isCompactLayout ? '100%' : 180,
                  maxWidth: isCompactLayout ? 320 : undefined,
                  height: isCompactLayout ? 'auto' : 180,
                  aspectRatio: isCompactLayout ? '1 / 1' : undefined,
                  objectFit: 'cover',
                  borderRadius: 10,
                  border: `1px solid ${theme.border}`,
                  flexShrink: 0,
                }}
              />
            )}
            <div style={{ flex: 1 }}>
              <h1 style={{ margin: '0 0 8px 0' }}>{toy.title}</h1>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                {!isOwner &&
                  (hasExpressedInterest ? (
                    <button
                      style={btnStyle}
                      onClick={handleCancelInterest}
                      disabled={interestActionLoading}
                    >
                      {interestActionLoading ? 'Saving…' : 'Cancel Interest'}
                    </button>
                  ) : (
                    <button
                      style={btnStyle}
                      onClick={handleExpressInterest}
                      disabled={interestActionLoading}
                    >
                      {interestActionLoading ? 'Saving…' : 'Interested'}
                    </button>
                  ))}

                {isPendingRecipient && (
                  <button
                    style={primaryBtnStyle}
                    onClick={handleAcceptTransferOnDetail}
                    disabled={acceptTransferLoading}
                  >
                    {acceptTransferLoading ? 'Saving…' : 'Accept Transfer'}
                  </button>
                )}

                {isOwner && (
                  <>
                    <button style={btnStyle} onClick={openEdit}>
                      Edit
                    </button>
                    <button style={{ ...btnStyle, color: theme.danger }} onClick={handleDeleteToy}>
                      Delete
                    </button>
                    {pendingTransferTo && (
                      <button
                        style={btnStyle}
                        onClick={handleCancelPendingTransfer}
                        disabled={cancelTransferLoading}
                        title={`Pending transfer to ${pendingTransferTo}`}
                      >
                        {cancelTransferLoading
                          ? 'Canceling…'
                          : `Cancel Transfer to ${pendingTransferTo}`}
                      </button>
                    )}
                  </>
                )}
              </div>

              {toy.owner_username && (
                <div style={{ marginBottom: 12 }}>
                  <div style={labelStyle}>Owner</div>
                  <Link
                    to={`/users/${encodeURIComponent(toy.owner_username)}`}
                    style={{ fontSize: 15, color: theme.link }}
                  >
                    {toy.owner_username}
                  </Link>
                </div>
              )}

              {(toy.min_age !== undefined || toy.max_age !== undefined) && (
                <div style={{ marginBottom: 12 }}>
                  <div style={labelStyle}>Age Range</div>
                  <span style={{ fontSize: 15 }}>
                    {toy.min_age ?? '?'} – {toy.max_age ?? '?'}
                  </span>
                </div>
              )}

              {toy.description && (
                <div style={{ marginBottom: 12 }}>
                  <div style={labelStyle}>Description</div>
                  <p
                    style={{ margin: 0, fontSize: 15, lineHeight: 1.6, color: theme.textSecondary }}
                  >
                    {toy.description}
                  </p>
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
                        flexDirection: isCompactLayout ? 'column' : 'row',
                        flexWrap: 'wrap',
                        alignItems: isCompactLayout ? 'flex-start' : 'center',
                        gap: 8,
                      }}
                    >
                      <span style={{ color: theme.textSecondary, fontSize: 14 }}>
                        Pending transfer to <strong>{pendingTransferTo}</strong>. Use the "Cancel
                        Transfer" button above to cancel it.
                      </span>
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

                  {interestDetail.can_view_usernames &&
                    (interestDetail.interested_usernames.length > 0 ? (
                      <>
                        <p style={{ margin: '0 0 8px 0', color: theme.textMuted, fontSize: 14 }}>
                          {pendingTransferTo
                            ? 'Cancel the pending transfer before starting a new one.'
                            : 'Click a username to start a transfer.'}
                        </p>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {interestDetail.interested_usernames.map((interestUser) => (
                            <button
                              key={interestUser.username}
                              type="button"
                              onClick={() => openTransferModal(interestUser.username)}
                              style={{
                                ...chipStyle,
                                border: 'none',
                                cursor: pendingTransferTo ? 'not-allowed' : 'pointer',
                                opacity: pendingTransferTo ? 0.7 : 1,
                                width: isCompactLayout ? '100%' : undefined,
                                textAlign: isCompactLayout ? 'left' : 'center',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 8,
                              }}
                              title={`Start a transfer to ${interestUser.username}\nInterested ${formatAbsoluteLocalTime(interestUser.created_at)}`}
                              disabled={Boolean(pendingTransferTo)}
                            >
                              <span>{interestUser.username}</span>
                              <span style={{ fontSize: 12, opacity: 0.85 }}>
                                {formatRelativeTime(interestUser.created_at)}
                              </span>
                            </button>
                          ))}
                        </div>
                      </>
                    ) : (
                      <p style={{ margin: 0, color: theme.textMuted, fontSize: 14 }}>
                        No users have expressed interest yet.
                      </p>
                    ))}
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
            token={token}
          />

          {formOpen && (
            <ToyFormModal
              token={token}
              editToy={toy}
              formData={formData}
              formError={formError}
              formLoading={formLoading}
              imageCompressing={imageCompressing}
              onClose={closeForm}
              handleFormChange={handleFormChange}
              handleImageFileChange={handleImageFileChange}
              handleFormSubmit={handleFormSubmit}
            />
          )}
        </>
      )}
    </main>
  )
}
