// ToyFormModal.tsx
import { type Toy } from '../../api/client'
import { useToyImage } from '../useToyImage'
import { useTheme } from '../../theme/ThemeContext'
import { useIsCompactLayout } from '../../theme/useIsCompactLayout'
import type { ToyFormData } from './useToysPage'

// 1. Define what data this modal needs from our custom hook
interface ToyFormModalProps {
  token: string
  editToy: Toy | null
  formData: ToyFormData
  formError: string | null
  formLoading: boolean
  onClose: () => void
  handleFormChange: (field: keyof Omit<ToyFormData, 'tags' | 'image_file' | 'image_preview_url'>, value: string) => void
  handleImageFileChange: (file: File | null) => void
  handleFormSubmit: () => Promise<void>
}

export function ToyFormModal({
  token,
  editToy,
  formData,
  formError,
  formLoading,
  onClose,
  handleFormChange,
  handleImageFileChange,
  handleFormSubmit,
}: ToyFormModalProps) {
  const { theme } = useTheme()
  const isCompactLayout = useIsCompactLayout()

  const { imageSrc: existingImageSrc } = useToyImage(token, formData.image_path || null, {
    enabled: !formData.image_preview_url,
  })
  const previewSrc = formData.image_preview_url ?? existingImageSrc

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

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        handleFormSubmit()
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

      <label style={{ ...labelStyle, gridColumn: '1 / -1' }}>
        Image
        <input
          type="file"
          accept="image/*"
          onChange={(e) => handleImageFileChange(e.target.files?.[0] ?? null)}
          style={inputStyle}
        />
      </label>

      {previewSrc && (
        <div style={{ gridColumn: '1 / -1' }}>
          <img
            src={previewSrc}
            alt="Preview"
            onError={(e) => {
              ;(e.currentTarget as HTMLImageElement).style.display = 'none'
            }}
            onLoad={(e) => {
              ;(e.currentTarget as HTMLImageElement).style.display = 'block'
            }}
            style={{
              display: 'block',
              maxHeight: 120,
              maxWidth: '100%',
              borderRadius: 6,
              border: `1px solid ${theme.border}`,
              objectFit: 'contain',
            }}
          />
        </div>
      )}

      {formError && (
        <p style={{ margin: 0, color: theme.error, fontSize: 13, gridColumn: '1 / -1' }}>
          {formError}
        </p>
      )}

      <div style={{ display: 'flex', gap: 8, gridColumn: '1 / -1', flexDirection: isCompactLayout ? 'column' : 'row' }}>
        <button type="submit" disabled={formLoading} style={primaryBtnStyle}>
          {formLoading ? 'Saving…' : 'Save'}
        </button>
        <button type="button" onClick={onClose} style={btnStyle}>
          Cancel
        </button>
      </div>
    </form>
  )
}