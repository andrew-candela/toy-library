// ToysPage.tsx
import { useEffect, useState } from 'react'
import { useToysPage } from './useToysPage'
import { ToyFormModal } from './ToyFormModal'
import { ToyTable } from './ToyTable'
import { TransferModal } from './TransferModal'
import { useTheme } from '../../theme/ThemeContext'
import { useIsCompactLayout } from '../../theme/useIsCompactLayout'

interface Props {
  token: string
}

export default function ToysPage({ token }: Props) {
  const { theme } = useTheme()
  const isCompactLayout = useIsCompactLayout()
  
  // Custom hook injects everything we need
  const hook = useToysPage(token)

  // Locally-buffered "suitable for age" text so the query only fires once the
  // user pauses typing, instead of on every keystroke (which was also causing
  // this input to unmount/lose focus while a request was in flight).
  const [ageInput, setAgeInput] = useState(hook.filterAge)

  useEffect(() => {
    const timer = setTimeout(() => {
      hook.setFilterAge(ageInput)
      hook.setCurrentPage(1)
    }, 400)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ageInput])

  // Semantic search is computationally expensive (embedding + vector search),
  // so unlike the age filter we don't debounce-fire on every pause in typing.
  // The input stays always-mounted; the query only runs when the user
  // explicitly presses Enter.
  const [searchInput, setSearchInput] = useState(hook.searchQuery)

  function submitSearch() {
    hook.setSearchQuery(searchInput)
    hook.setCurrentPage(1)
  }

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

  return (
    <main style={{ padding: isCompactLayout ? '24px 16px' : '40px 32px' }}>
      <div style={{ display: 'flex', alignItems: isCompactLayout ? 'stretch' : 'center', justifyContent: 'space-between', flexDirection: isCompactLayout ? 'column' : 'row', gap: isCompactLayout ? 12 : 0, marginBottom: 24 }}>
        <h1 style={{ margin: 0 }}>Toys</h1>
        {!hook.ownerUsername && (
          <button style={{ ...primaryBtnStyle, width: isCompactLayout ? '100%' : undefined }} onClick={hook.openCreate}>
            + Add Toy
          </button>
        )}
      </div>
      
      {hook.ownerUsername && (
        <div style={{ marginBottom: 16, padding: '12px 14px', borderRadius: 8, border: `1px solid ${theme.border}`, background: theme.surfaceAlt, fontSize: 14, color: theme.textSecondary, display: 'flex', flexDirection: isCompactLayout ? 'column' : 'row', alignItems: isCompactLayout ? 'flex-start' : 'center', justifyContent: 'space-between', gap: 8 }}>
          <span>Showing toys owned by <strong>{hook.ownerUsername}</strong></span>
          <button onClick={() => hook.setOwnerUsername('')} style={{ background: 'none', border: 'none', color: theme.link, textDecoration: 'none', fontWeight: 500, fontSize: 13, cursor: 'pointer' }}>Clear filter →</button>
        </div>
      )}

      {hook.transferAcceptedMessage && (
        <div
          style={{
            marginBottom: 16,
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
            You have accepted the transfer of <strong>{hook.transferAcceptedMessage}</strong>. You
            are now the owner of this toy.
          </span>
          <button
            type="button"
            onClick={hook.dismissTransferAcceptedMessage}
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

      {/* 1. Semantic Search */}
      <div style={{ marginBottom: 16 }}>
        <input
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              submitSearch()
            }
          }}
          placeholder="Sort toys by description, then press Enter (e.g. 'wooden building blocks')…"
          style={{
            width: '100%',
            boxSizing: 'border-box',
            padding: '8px 12px',
            borderRadius: 6,
            border: `1px solid ${theme.border}`,
            background: theme.inputBg,
            color: theme.textPrimary,
            fontSize: 14,
          }}
        />
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: isCompactLayout ? 'flex-start' : 'flex-end',
          alignItems: 'center',
          gap: 16,
          flexDirection: isCompactLayout ? 'column' : 'row',
          marginBottom: 16,
        }}
      >
        <label
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 14,
            color: theme.textSecondary,
          }}
        >
          Suitable for age
          <input
            type="number"
            min={0}
            value={ageInput}
            onChange={(e) => setAgeInput(e.target.value)}
            style={{
              width: 72,
              padding: '4px 8px',
              borderRadius: 6,
              border: `1px solid ${theme.border}`,
              background: theme.inputBg,
              color: theme.textPrimary,
              fontSize: 14,
            }}
          />
        </label>
        <label
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 14,
            color: theme.textSecondary,
          }}
        >
          Neighborhood
          <select
            value={hook.filterNeighborhood}
            onChange={(e) => {
              hook.setFilterNeighborhood(e.target.value)
              hook.setCurrentPage(1)
            }}
            style={{
              padding: '4px 8px',
              borderRadius: 6,
              border: `1px solid ${theme.border}`,
              background: theme.inputBg,
              color: theme.textPrimary,
              fontSize: 14,
            }}
          >
            <option value="">All neighborhoods</option>
            {hook.neighborhoods.map((neighborhood) => (
              <option key={neighborhood} value={neighborhood}>
                {neighborhood}
              </option>
            ))}
          </select>
        </label>
        <label
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 14,
            color: theme.textSecondary,
          }}
        >
          <input
            type="checkbox"
            checked={hook.showOnlyMyToys}
            onChange={(e) => {
              hook.setShowOnlyMyToys(e.target.checked)
              if (e.target.checked) hook.setOwnerUsername('')
              hook.setCurrentPage(1)
            }}
          />
          My toys only
        </label>
      </div>

      {/* 2. Create / Edit Form Modal */}
      {hook.formOpen && (
        <ToyFormModal
          token={token}
          editToy={hook.editToy}
          formData={hook.formData}
          formError={hook.formError}
          formLoading={hook.formLoading}
          imageCompressing={hook.imageCompressing}
          onClose={hook.closeForm}
          handleFormChange={hook.handleFormChange}
          handleImageFileChange={hook.handleImageFileChange}
          handleFormSubmit={hook.handleFormSubmit}
        />
      )}

      {/* 3. Transfer Action Modal Overlay */}
      <TransferModal
        open={Boolean(hook.transferToy)}
        toyTitle={hook.transferToy?.title ?? ''}
        recipientUsername={hook.transferUsername}
        setRecipientUsername={hook.setTransferUsername}
        loading={hook.transferLoading}
        error={hook.transferError}
        onClose={hook.closeTransferModal}
        onSubmit={hook.handleTransferSubmit}
      />

      {hook.error && <p style={{ color: theme.error }}>{hook.error}</p>}
      {hook.loading && <p style={{ color: theme.textMuted }}>Loading…</p>}

      {/* 4. Core Grid Data Layout */}
      {!hook.loading && (
        <>
          <ToyTable
            token={token}
            toys={hook.toys}
            ownedToyIds={hook.ownedToyIds}
            pendingIncomingToyIds={hook.pendingIncomingToyIds}
            myInterestedToyIds={hook.myInterestedToyIds}
            interestCountsByToy={hook.interestCountsByToy}
            pendingTransferToByToy={hook.pendingTransferToByToy}
            isActionLoading={hook.isActionLoading}
            onCancelInterest={hook.handleCancelInterest}
            onExpressInterest={hook.handleExpressInterest}
            onAcceptTransfer={hook.handleAcceptTransfer}
            onCancelTransfer={hook.handleCancelTransfer}
            onOpenEdit={hook.openEdit}
            onDelete={hook.handleDelete}
            onOpenTransferModal={hook.openTransferModal}
          />

          {/* Pagination Controls */}
          {hook.totalPages > 1 && (
            <div style={{ display: 'flex', alignItems: isCompactLayout ? 'stretch' : 'center', flexDirection: isCompactLayout ? 'column' : 'row', gap: 12, marginTop: 16 }}>
              <button
                style={{ ...btnStyle, opacity: hook.currentPage === 1 ? 0.5 : 1, width: isCompactLayout ? '100%' : undefined }}
                disabled={hook.currentPage === 1}
                onClick={() => hook.setCurrentPage((p) => p - 1)}
              >
                Previous
              </button>
              <span style={{ fontSize: 14, color: theme.textSecondary }}>
                Page {hook.currentPage} of {hook.totalPages}
              </span>
              <button
                style={{ ...btnStyle, opacity: hook.currentPage === hook.totalPages ? 0.5 : 1, width: isCompactLayout ? '100%' : undefined }}
                disabled={hook.currentPage === hook.totalPages}
                onClick={() => hook.setCurrentPage((p) => p + 1)}
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </main>
  )
}