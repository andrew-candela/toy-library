// ToyTable.tsx
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { type Toy } from '../../api/client'
import { useToyImage } from '../useToyImage'
import { useTheme } from '../../theme/ThemeContext'
import { useIsCompactLayout } from '../../theme/useIsCompactLayout'

interface ToyTableProps {
  token: string
  toys: Toy[]
  ownedToyIds: Set<number>
  pendingIncomingToyIds: Set<number>
  myInterestedToyIds: Set<number>
  interestCountsByToy: Record<number, number>
  pendingTransferToByToy: Record<number, string>
  isActionLoading: (key: string) => boolean
  onCancelInterest: (id: number) => Promise<void>
  onExpressInterest: (id: number) => Promise<void>
  onAcceptTransfer: (id: number) => Promise<void>
  onCancelTransfer: (id: number) => Promise<void>
  onOpenEdit: (toy: Toy) => void
  onDelete: (toy: Toy) => void
  onOpenTransferModal: (toy: Toy) => void
}

interface ToyThumbnailProps {
  token: string
  toy: Toy
  size: number
  borderRadius: number
  borderColor: string
  placeholderBg: string
  flexShrink?: 0
}

function ToyThumbnail({
  token,
  toy,
  size,
  borderRadius,
  borderColor,
  placeholderBg,
  flexShrink,
}: ToyThumbnailProps) {
  const { imageSrc } = useToyImage(token, toy.image_path ?? null)
  const [imageFailed, setImageFailed] = useState(false)

  useEffect(() => {
    setImageFailed(false)
  }, [imageSrc, toy.image_path])

  const showImage = Boolean(toy.image_path && imageSrc && !imageFailed)

  return (
    <>
      {showImage ? (
        <img
          src={imageSrc ?? undefined}
          alt={toy.title}
          onError={() => setImageFailed(true)}
          style={{
            width: size,
            height: size,
            objectFit: 'cover',
            borderRadius,
            border: `1px solid ${borderColor}`,
            display: 'block',
            flexShrink,
          }}
        />
      ) : null}
      <div
        style={{
          display: showImage ? 'none' : 'block',
          width: size,
          height: size,
          borderRadius,
          background: placeholderBg,
          border: `1px solid ${borderColor}`,
          flexShrink,
        }}
      />
    </>
  )
}

export function ToyTable({
  token,
  toys,
  ownedToyIds,
  pendingIncomingToyIds,
  myInterestedToyIds,
  interestCountsByToy,
  pendingTransferToByToy,
  isActionLoading,
  onCancelInterest,
  onExpressInterest,
  onAcceptTransfer,
  onCancelTransfer,
  onOpenEdit,
  onDelete,
  onOpenTransferModal,
}: ToyTableProps) {
  const { theme } = useTheme()
  const isCompactLayout = useIsCompactLayout()

  // --- Scoped CSS Styles ---
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

  const thStyle: React.CSSProperties = {
    textAlign: 'left',
    padding: '8px 12px',
    borderBottom: `2px solid ${theme.border}`,
    fontWeight: 600,
    fontSize: 13,
    color: theme.textSecondary,
  }

  const tdStyle: React.CSSProperties = {
    padding: '8px 12px',
    borderBottom: `1px solid ${theme.borderMuted}`,
    fontSize: 14,
  }

  const chipStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    padding: '2px 8px',
    borderRadius: 12,
    background: theme.chipBg,
    color: theme.chipText,
    fontSize: 12,
    fontWeight: 500,
  }

  const cardStyle: React.CSSProperties = {
    border: `1px solid ${theme.border}`,
    borderRadius: 10,
    background: theme.surface,
    padding: 14,
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  }

  const labelStyle: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 600,
    color: theme.textMuted,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  }

  if (isCompactLayout) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {toys.length === 0 && (
          <div style={{ ...cardStyle, color: theme.textMuted }}>No toys yet.</div>
        )}

        {toys.map((toy) => {
          const isOwner = ownedToyIds.has(toy.id)
          const isPendingRecipient = pendingIncomingToyIds.has(toy.id)
          const hasExpressedInterest = myInterestedToyIds.has(toy.id)
          const interestCount = interestCountsByToy[toy.id] ?? 0
          const pendingTransferTo = pendingTransferToByToy[toy.id]
          const interestKey = `interest-${toy.id}`
          const transferKey = `transfer-${toy.id}`

          return (
            <article key={toy.id} style={cardStyle}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <ToyThumbnail
                  token={token}
                  toy={toy}
                  size={72}
                  borderRadius={8}
                  borderColor={theme.border}
                  placeholderBg={theme.imagePlaceholderBg}
                  flexShrink={0}
                />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <Link
                    to={`/toys/${toy.id}`}
                    style={{
                      color: theme.link,
                      textDecoration: 'none',
                      fontWeight: 600,
                      fontSize: 16,
                    }}
                  >
                    {toy.title}
                  </Link>
                  <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div>
                      <div style={labelStyle}>Min Age</div>
                      <div style={{ color: theme.textPrimary, fontSize: 14 }}>
                        {toy.min_age ?? '—'}
                      </div>
                    </div>
                    <div>
                      <div style={labelStyle}>Max Age</div>
                      <div style={{ color: theme.textPrimary, fontSize: 14 }}>
                        {toy.max_age ?? '—'}
                      </div>
                    </div>
                    <div>
                      <div style={labelStyle}>Neighborhood</div>
                      <div style={{ color: theme.textPrimary, fontSize: 14 }}>
                        {toy.neighborhood ?? '—'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {!isOwner &&
                  (hasExpressedInterest ? (
                    <button
                      style={btnStyle}
                      onClick={() => onCancelInterest(toy.id)}
                      disabled={isActionLoading(interestKey)}
                    >
                      {isActionLoading(interestKey) ? 'Saving…' : 'Cancel Interest'}
                    </button>
                  ) : (
                    <button
                      style={btnStyle}
                      onClick={() => onExpressInterest(toy.id)}
                      disabled={isActionLoading(interestKey)}
                    >
                      {isActionLoading(interestKey) ? 'Saving…' : 'Interested'}
                    </button>
                  ))}

                <span
                  style={{
                    ...chipStyle,
                    background: theme.surface,
                    border: `1px solid ${theme.border}`,
                    color: theme.textSecondary,
                  }}
                >
                  {interestCount} interested
                </span>

                {isPendingRecipient && (
                  <button
                    style={primaryBtnStyle}
                    onClick={() => onAcceptTransfer(toy.id)}
                    disabled={isActionLoading(transferKey)}
                  >
                    {isActionLoading(transferKey) ? 'Saving…' : 'Accept Transfer'}
                  </button>
                )}

                {isOwner && (
                  <>
                    <button style={btnStyle} onClick={() => onOpenEdit(toy)}>
                      Edit
                    </button>
                    <button
                      style={{ ...btnStyle, color: theme.danger }}
                      onClick={() => onDelete(toy)}
                    >
                      Delete
                    </button>

                    {pendingTransferTo ? (
                      <button
                        style={btnStyle}
                        onClick={() => onCancelTransfer(toy.id)}
                        disabled={isActionLoading(transferKey)}
                        title={`Pending transfer to ${pendingTransferTo}`}
                      >
                        {isActionLoading(transferKey)
                          ? 'Saving…'
                          : `Cancel Transfer to ${pendingTransferTo}`}
                      </button>
                    ) : (
                      <button style={btnStyle} onClick={() => onOpenTransferModal(toy)}>
                        Transfer
                      </button>
                    )}
                  </>
                )}
              </div>
            </article>
          )
        })}
      </div>
    )
  }

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr>
          <th style={{ ...thStyle, width: 64 }}>Image</th>
          <th style={thStyle}>Title</th>
          <th style={thStyle}>Min Age</th>
          <th style={thStyle}>Max Age</th>
          <th style={thStyle}>Neighborhood</th>
          <th style={thStyle}>Actions</th>
        </tr>
      </thead>
      <tbody>
        {toys.length === 0 && (
          <tr>
            <td colSpan={6} style={{ ...tdStyle, color: theme.textMuted }}>
              No toys yet.
            </td>
          </tr>
        )}

        {toys.map((toy) => {
          const isOwner = ownedToyIds.has(toy.id)
          const isPendingRecipient = pendingIncomingToyIds.has(toy.id)
          const hasExpressedInterest = myInterestedToyIds.has(toy.id)
          const interestCount = interestCountsByToy[toy.id] ?? 0
          const pendingTransferTo = pendingTransferToByToy[toy.id]
          const interestKey = `interest-${toy.id}`
          const transferKey = `transfer-${toy.id}`

          return (
            <tr key={toy.id}>
              {/* Image Column */}
              <td style={tdStyle}>
                <ToyThumbnail
                  token={token}
                  toy={toy}
                  size={48}
                  borderRadius={6}
                  borderColor={theme.border}
                  placeholderBg={theme.imagePlaceholderBg}
                />
              </td>

              {/* Title Link Column */}
              <td style={tdStyle}>
                <Link
                  to={`/toys/${toy.id}`}
                  style={{ color: theme.link, textDecoration: 'none', fontWeight: 500 }}
                >
                  {toy.title}
                </Link>
              </td>

              {/* Min Age Column */}
              <td style={tdStyle}>{toy.min_age ?? '—'}</td>

              {/* Max Age Column */}
              <td style={tdStyle}>{toy.max_age ?? '—'}</td>

              {/* Neighborhood Column */}
              <td style={tdStyle}>{toy.neighborhood ?? '—'}</td>

              {/* Actions Column */}
              <td style={tdStyle}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {!isOwner &&
                    (hasExpressedInterest ? (
                      <button
                        style={btnStyle}
                        onClick={() => onCancelInterest(toy.id)}
                        disabled={isActionLoading(interestKey)}
                      >
                        {isActionLoading(interestKey) ? 'Saving…' : 'Cancel Interest'}
                      </button>
                    ) : (
                      <button
                        style={btnStyle}
                        onClick={() => onExpressInterest(toy.id)}
                        disabled={isActionLoading(interestKey)}
                      >
                        {isActionLoading(interestKey) ? 'Saving…' : 'Interested'}
                      </button>
                    ))}

                  <span
                    style={{
                      ...chipStyle,
                      background: theme.surface,
                      border: `1px solid ${theme.border}`,
                      color: theme.textSecondary,
                    }}
                  >
                    {interestCount} interested
                  </span>

                  {isPendingRecipient && (
                    <button
                      style={primaryBtnStyle}
                      onClick={() => onAcceptTransfer(toy.id)}
                      disabled={isActionLoading(transferKey)}
                    >
                      {isActionLoading(transferKey) ? 'Saving…' : 'Accept Transfer'}
                    </button>
                  )}

                  {isOwner && (
                    <>
                      <button style={btnStyle} onClick={() => onOpenEdit(toy)}>
                        Edit
                      </button>
                      <button
                        style={{ ...btnStyle, color: theme.danger }}
                        onClick={() => onDelete(toy)}
                      >
                        Delete
                      </button>

                      {pendingTransferTo ? (
                        <button
                          style={btnStyle}
                          onClick={() => onCancelTransfer(toy.id)}
                          disabled={isActionLoading(transferKey)}
                          title={`Pending transfer to ${pendingTransferTo}`}
                        >
                          {isActionLoading(transferKey)
                            ? 'Saving…'
                            : `Cancel Transfer to ${pendingTransferTo}`}
                        </button>
                      ) : (
                        <button style={btnStyle} onClick={() => onOpenTransferModal(toy)}>
                          Transfer
                        </button>
                      )}
                    </>
                  )}
                </div>
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
