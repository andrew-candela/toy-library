// ToyFormModal.tsx
import { useState } from 'react'
import { MAX_TOY_IMAGES, type Toy } from '../../api/client'
import { ToyImageView } from '../ToyImageView'
import { useTheme } from '../../theme/ThemeContext'
import { useIsCompactLayout } from '../../theme/useIsCompactLayout'
import { slotSource, type ToyImagesForm } from './useToyImagesForm'
import type { ToyFormData } from './useToysPage'

// 1. Define what data this modal needs from our custom hook
interface ToyFormModalProps {
  token: string
  editToy: Toy | null
  formData: ToyFormData
  formError: string | null
  formLoading: boolean
  images: ToyImagesForm
  onClose: () => void
  handleFormChange: (field: keyof Omit<ToyFormData, 'tags'>, value: string) => void
  handleFormSubmit: () => Promise<void>
}

export function ToyFormModal({
  token,
  editToy,
  formData,
  formError,
  formLoading,
  images,
  onClose,
  handleFormChange,
  handleFormSubmit,
}: ToyFormModalProps) {
  const { theme } = useTheme()
  const isCompactLayout = useIsCompactLayout()
  const [linkDraft, setLinkDraft] = useState('')
  const [linkError, setLinkError] = useState<string | null>(null)

  function handleAddLink() {
    const error = images.addUrl(linkDraft)
    setLinkError(error)
    if (!error) setLinkDraft('')
  }

  // --- Scoped Styling Objects ---
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

  const smallBtnStyle: React.CSSProperties = {
    ...btnStyle,
    padding: '3px 6px',
    fontSize: 12,
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        void handleFormSubmit()
      }}
      style={{
        background: theme.surfaceAlt,
        border: `1px solid ${theme.border}`,
        borderRadius: 8,
        padding: isCompactLayout ? '18px 16px' : '20px 24px',
        marginBottom: 24,
        display: 'grid',
        gridTemplateColumns: isCompactLayout ? '1fr' : '1fr 1fr',
        gap: 12,
        maxWidth: 640,
      }}
    >
      <h3 style={{ margin: 0, gridColumn: '1 / -1' }}>{editToy ? 'Edit Toy' : 'New Toy'}</h3>

      <label style={labelStyle}>
        Title *
        <input
          value={formData.title}
          onChange={(e) => handleFormChange('title', e.target.value)}
          required
          style={inputStyle}
        />
      </label>

      <label style={labelStyle}>
        Min Age
        <input
          type="number"
          min={0}
          value={formData.min_age}
          onChange={(e) => handleFormChange('min_age', e.target.value)}
          style={inputStyle}
        />
      </label>

      <label style={labelStyle}>
        Max Age
        <input
          type="number"
          min={0}
          value={formData.max_age}
          onChange={(e) => handleFormChange('max_age', e.target.value)}
          style={inputStyle}
        />
      </label>

      <label style={{ ...labelStyle, gridColumn: '1 / -1' }}>
        Description
        <input
          value={formData.description}
          onChange={(e) => handleFormChange('description', e.target.value)}
          style={inputStyle}
        />
      </label>

      <div style={{ ...labelStyle, gridColumn: '1 / -1' }}>
        <span>Photos</span>
        <span style={{ fontSize: 12, color: theme.textSecondary }}>
          Up to {MAX_TOY_IMAGES} photos. The first one is the cover.
        </span>

        {images.slots.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 4 }}>
            {images.slots.map((slot, index) => (
              <div
                key={slot.key}
                style={{ display: 'flex', flexDirection: 'column', gap: 4, width: 104 }}
              >
                <ToyImageView
                  token={token}
                  image={slotSource(slot)}
                  alt={index === 0 ? 'Cover photo' : `Photo ${index + 1}`}
                  placeholderBg={theme.imagePlaceholderBg}
                  style={{
                    width: 104,
                    height: 104,
                    borderRadius: 6,
                    border: `${index === 0 ? 2 : 1}px solid ${index === 0 ? theme.ctaBg : theme.border}`,
                  }}
                />
                {index === 0 ? (
                  <span style={{ fontSize: 12, color: theme.textSecondary, textAlign: 'center' }}>
                    Cover
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => images.makeCover(slot.key)}
                    style={smallBtnStyle}
                  >
                    Make cover
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => images.remove(slot.key)}
                  style={{ ...smallBtnStyle, color: theme.danger }}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}

        <input
          type="file"
          accept="image/*"
          multiple
          disabled={!images.canAddMore}
          aria-label="Upload photos"
          onChange={(e) => {
            const files = Array.from(e.target.files ?? [])
            // Cleared so picking the same file again still fires onChange.
            e.target.value = ''
            void images.addFiles(files)
          }}
          style={inputStyle}
        />
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="url"
            inputMode="url"
            placeholder="Paste image link (https://…)"
            aria-label="Paste image link"
            value={linkDraft}
            disabled={!images.canAddMore}
            onChange={(e) => {
              setLinkDraft(e.target.value)
              setLinkError(null)
            }}
            onKeyDown={(e) => {
              // Enter here means "add this link", not "save the toy".
              if (e.key === 'Enter') {
                e.preventDefault()
                handleAddLink()
              }
            }}
            style={{ ...inputStyle, flex: 1, minWidth: 0 }}
          />
          <button
            type="button"
            onClick={handleAddLink}
            disabled={!images.canAddMore}
            style={btnStyle}
          >
            Add
          </button>
        </div>
        {images.slots.length >= MAX_TOY_IMAGES && (
          <span style={{ fontSize: 12, color: theme.textSecondary }}>
            Up to {MAX_TOY_IMAGES} photos — remove one to add another.
          </span>
        )}
        {linkError && <span style={{ fontSize: 12, color: theme.error }}>{linkError}</span>}
        {images.compressing && (
          <span style={{ fontSize: 12, color: theme.textSecondary }}>Compressing image…</span>
        )}
      </div>

      {formError && (
        <p style={{ margin: 0, color: theme.error, fontSize: 13, gridColumn: '1 / -1' }}>
          {formError}
        </p>
      )}

      <div
        style={{
          display: 'flex',
          gap: 8,
          gridColumn: '1 / -1',
          flexDirection: isCompactLayout ? 'column' : 'row',
        }}
      >
        <button type="submit" disabled={formLoading || images.compressing} style={primaryBtnStyle}>
          {formLoading ? 'Saving…' : 'Save'}
        </button>
        <button type="button" onClick={onClose} style={btnStyle}>
          Cancel
        </button>
      </div>
    </form>
  )
}
