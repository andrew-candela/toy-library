// ToyTable.tsx
import { Link } from 'react-router-dom'
import { type Toy } from '../../api/client'
import { useTheme } from '../../theme/ThemeContext'

interface ToyTableProps {
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
  onTagClick: (tag: string) => void
}

export function ToyTable({
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
  onTagClick,
}: ToyTableProps) {
  const { theme } = useTheme()

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

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr>
          <th style={{ ...thStyle, width: 64 }}>Image</th>
          <th style={thStyle}>Title</th>
          <th style={thStyle}>Tags</th>
          <th style={thStyle}>Age Range</th>
          <th style={thStyle}>Actions</th>
        </tr>
      </thead>
      <tbody>
        {toys.length === 0 && (
          <tr>
            <td colSpan={5} style={{ ...tdStyle, color: theme.textMuted }}>
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
                {toy.image_url ? (
                  <img
                    src={toy.image_url}
                    alt={toy.title}
                    onError={(e) => {
                      const img = e.currentTarget as HTMLImageElement
                      img.style.display = 'none'
                      const placeholder = img.nextElementSibling as HTMLElement | null
                      if (placeholder) placeholder.style.display = 'block'
                    }}
                    style={{
                      width: 48,
                      height: 48,
                      objectFit: 'cover',
                      borderRadius: 6,
                      border: `1px solid ${theme.border}`,
                      display: 'block',
                    }}
                  />
                ) : null}
                <div
                  style={{
                    display: toy.image_url ? 'none' : 'block',
                    width: 48,
                    height: 48,
                    borderRadius: 6,
                    background: theme.imagePlaceholderBg,
                    border: `1px solid ${theme.border}`,
                  }}
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

              {/* Tags Column */}
              <td style={tdStyle}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {toy.tags.length === 0 ? (
                    <span style={{ color: theme.textDisabled }}>—</span>
                  ) : (
                    toy.tags.map((tag) => (
                      <span
                        key={tag}
                        style={{ ...chipStyle, cursor: 'pointer' }}
                        title={`Filter by #${tag}`}
                        onClick={() => onTagClick(tag)}
                      >
                        #{tag}
                      </span>
                    ))
                  )}
                </div>
              </td>

              {/* Age Range Column */}
              <td style={tdStyle}>{toy.age_range ?? '—'}</td>

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

                  {isOwner && (
                    <span
                      style={{
                        ...chipStyle,
                        background: theme.surfaceAlt,
                        border: `1px solid ${theme.border}`,
                        color: theme.textMuted,
                      }}
                      title="You own this toy"
                    >
                      Owner
                    </span>
                  )}

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
