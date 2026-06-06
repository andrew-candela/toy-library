// ToysPage.tsx
import { useToysPage } from './useToysPage'
import { TagFilterBar } from './TagFilterBar'
import { ToyFormModal } from './ToyFormModal'
import { ToyTable } from './ToyTable'
import { useTheme } from '../../theme/ThemeContext'

interface Props {
  token: string
}

export default function ToysPage({ token }: Props) {
  const { theme } = useTheme()
  
  // Custom hook injects everything we need
  const hook = useToysPage(token)

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
    <main style={{ padding: '40px 32px' }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ margin: 0 }}>Toys</h1>
        <button style={primaryBtnStyle} onClick={hook.openCreate}>
          + Add Toy
        </button>
      </div>

      {/* 1. Filtering Module */}
      <TagFilterBar
        token={token}
        filterTags={hook.filterTags}
        setFilterTags={hook.setFilterTags}
        setCurrentPage={hook.setCurrentPage}
      />

      {/* 2. Create / Edit Form Modal */}
      {hook.formOpen && (
        <ToyFormModal
          token={token}
          editToy={hook.editToy}
          formData={hook.formData}
          setFormData={hook.setFormData}
          formError={hook.formError}
          formLoading={hook.formLoading}
          onClose={hook.closeForm}
          handleFormChange={hook.handleFormChange}
          handleFormSubmit={hook.handleFormSubmit}
        />
      )}

      {/* 3. Transfer Action Modal Overlay */}
      {hook.transferToy && (
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
              hook.handleTransferSubmit(hook.transferUsername.trim())
            }}
            style={{
              width: '100%',
              maxWidth: 420,
              background: theme.surfaceAlt,
              border: `1px solid ${theme.border}`,
              borderRadius: 10,
              padding: '18px 20px',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            <h3 style={{ margin: 0 }}>Transfer {hook.transferToy.title}</h3>
            <label style={labelStyle}>
              Recipient Username
              <input
                value={hook.transferUsername}
                onChange={(e) => hook.setTransferUsername(e.target.value)}
                style={inputStyle}
                placeholder="Enter username"
                autoFocus
              />
            </label>
            {hook.transferError && (
              <p style={{ margin: 0, color: theme.error, fontSize: 13 }}>{hook.transferError}</p>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="submit" disabled={hook.transferLoading} style={primaryBtnStyle}>
                {hook.transferLoading ? 'Starting…' : 'Start Transfer'}
              </button>
              <button type="button" onClick={hook.closeTransferModal} style={btnStyle}>
                Close
              </button>
            </div>
          </form>
        </div>
      )}

      {hook.error && <p style={{ color: theme.error }}>{hook.error}</p>}
      {hook.loading && <p style={{ color: theme.textMuted }}>Loading…</p>}

      {/* 4. Core Grid Data Layout */}
      {!hook.loading && (
        <>
          <ToyTable
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
            onTagClick={(tag) => {
              if (!hook.filterTags.includes(tag)) {
                hook.setFilterTags((prev) => [...prev, tag])
              }
            }}
          />

          {/* Pagination Controls */}
          {hook.totalPages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 16 }}>
              <button
                style={{ ...btnStyle, opacity: hook.currentPage === 1 ? 0.5 : 1 }}
                disabled={hook.currentPage === 1}
                onClick={() => hook.setCurrentPage((p) => p - 1)}
              >
                Previous
              </button>
              <span style={{ fontSize: 14, color: theme.textSecondary }}>
                Page {hook.currentPage} of {hook.totalPages}
              </span>
              <button
                style={{ ...btnStyle, opacity: hook.currentPage === hook.totalPages ? 0.5 : 1 }}
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