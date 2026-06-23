// ToyFormModal.tsx
import { useEffect, useState } from 'react'
import { fetchTagSuggestions, type Toy } from '../../api/client'
import { useTheme } from '../../theme/ThemeContext'
import { useIsCompactLayout } from '../../theme/useIsCompactLayout'
import type { ToyFormData } from './useToysPage'

// 1. Define what data this modal needs from our custom hook
interface ToyFormModalProps {
  token: string
  editToy: Toy | null
  formData: ToyFormData
  setFormData: React.Dispatch<React.SetStateAction<ToyFormData>>
  formError: string | null
  formLoading: boolean
  onClose: () => void
  handleFormChange: (field: keyof Omit<ToyFormData, 'tags' | 'image_file' | 'image_preview_url'>, value: string) => void
  handleImageFileChange: (file: File | null) => void
  handleFormSubmit: (finalTags: string[]) => Promise<void>
}

function normalizeTag(raw: string): string {
  return raw.replace(/^#+/, '').trim().toLowerCase()
}

export function ToyFormModal({
  token,
  editToy,
  formData,
  setFormData,
  formError,
  formLoading,
  onClose,
  handleFormChange,
  handleImageFileChange,
  handleFormSubmit,
}: ToyFormModalProps) {
  const { theme } = useTheme()
  const isCompactLayout = useIsCompactLayout()

  // 2. Local, self-contained UI state for tag autocomplete
  const [tagInput, setTagInput] = useState('')
  const [formSuggestions, setFormSuggestions] = useState<string[]>([])
  const [showFormDropdown, setShowFormDropdown] = useState(false)

  // 3. Isolated debounce effect for tag autocomplete suggestions
  useEffect(() => {
    const normalized = normalizeTag(tagInput)
    if (!normalized) {
      setFormSuggestions([])
      setShowFormDropdown(false)
      return
    }
    const timer = setTimeout(() => {
      fetchTagSuggestions(token, normalized)
        .then((tags) => {
          setFormSuggestions(tags)
          setShowFormDropdown(tags.length > 0)
        })
        .catch(() => {
          setFormSuggestions([])
          setShowFormDropdown(false)
        })
    }, 150)
    return () => clearTimeout(timer)
  }, [tagInput, token])

  // 4. Tag pill manipulation functions
  function addFormTag(raw: string) {
    const tag = normalizeTag(raw)
    if (tag && !formData.tags.includes(tag)) {
      setFormData((prev) => ({ ...prev, tags: [...prev.tags, tag] }))
    }
    setTagInput('')
    setFormSuggestions([])
    setShowFormDropdown(false)
  }

  function removeFormTag(tag: string) {
    setFormData((prev) => ({ ...prev, tags: prev.tags.filter((t) => t !== tag) }))
  }

  function handleTagKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      addFormTag(tagInput)
    } else if (e.key === 'Escape') {
      setShowFormDropdown(false)
    }
  }

  function handleTagInputChange(value: string) {
    if (value.endsWith(',')) {
      addFormTag(value.slice(0, -1))
    } else {
      setTagInput(value)
    }
  }

  const previewSrc = formData.image_preview_url ?? formData.image_path

  // Intercepting actual HTML submit to flush the tag input cleanly
  function onSubmitWrapper(e: React.FormEvent) {
    e.preventDefault()
    const pendingTag = normalizeTag(tagInput)
    const finalTags =
      pendingTag && !formData.tags.includes(pendingTag)
        ? [...formData.tags, pendingTag]
        : formData.tags
    handleFormSubmit(finalTags)
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

  const chipXStyle: React.CSSProperties = {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: 0,
    lineHeight: 1,
    color: theme.chipText,
    fontSize: 14,
  }

  const dropdownStyle: React.CSSProperties = {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    zIndex: 100,
    background: theme.dropdownBg,
    border: `1px solid ${theme.border}`,
    borderRadius: 6,
    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
    marginTop: 2,
    overflow: 'hidden',
  }

  return (
    <form
      onSubmit={onSubmitWrapper}
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
        Age Range
        <input
          value={formData.age_range}
          onChange={(e) => handleFormChange('age_range', e.target.value)}
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

      <div style={{ ...labelStyle, gridColumn: '1 / -1' }}>
        <span>Tags</span>
        <div
          style={{
            position: 'relative',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: 6,
            padding: '6px 8px',
            borderRadius: 6,
            border: `1px solid ${theme.border}`,
            background: theme.inputBg,
            minHeight: 38,
          }}
        >
          {formData.tags.map((tag) => (
            <span key={tag} style={chipStyle}>
              #{tag}
              <button
                type="button"
                onClick={() => removeFormTag(tag)}
                style={chipXStyle}
                aria-label={`Remove tag ${tag}`}
              >
                ×
              </button>
            </span>
          ))}
          <input
            value={tagInput}
            onChange={(e) => handleTagInputChange(e.target.value)}
            onKeyDown={handleTagKeyDown}
            onBlur={() => setTimeout(() => setShowFormDropdown(false), 150)}
            placeholder={formData.tags.length === 0 ? 'Type a tag, then Enter or comma…' : ''}
            style={{
              border: 'none',
              outline: 'none',
              fontSize: 14,
              padding: '2px 4px',
              flexGrow: 1,
              minWidth: 120,
              background: 'transparent',
              color: theme.textPrimary,
            }}
          />
          {showFormDropdown && (
            <div style={dropdownStyle}>
              {formSuggestions.map((tag) => (
                <div
                  key={tag}
                  onMouseDown={() => addFormTag(tag)}
                  onMouseEnter={(e) => {
                    ;(e.currentTarget as HTMLDivElement).style.background = theme.surfaceHover
                  }}
                  onMouseLeave={(e) => {
                    ;(e.currentTarget as HTMLDivElement).style.background = theme.dropdownBg
                  }}
                  style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 13 }}
                >
                  #{tag}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

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