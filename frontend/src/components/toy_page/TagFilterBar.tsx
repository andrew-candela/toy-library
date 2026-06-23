// TagFilterBar.tsx
import { useEffect, useState } from 'react'
import { fetchTagSuggestions } from '../../api/client'
import { useTheme } from '../../theme/ThemeContext'
import { useIsCompactLayout } from '../../theme/useIsCompactLayout'

interface TagFilterBarProps {
  token: string
  filterTags: string[]
  setFilterTags: React.Dispatch<React.SetStateAction<string[]>>
  setCurrentPage: React.Dispatch<React.SetStateAction<number>>
}

function normalizeTag(raw: string): string {
  return raw.replace(/^#+/, '').trim().toLowerCase()
}

export function TagFilterBar({
  token,
  filterTags,
  setFilterTags,
  setCurrentPage,
}: TagFilterBarProps) {
  const { theme } = useTheme()
  const isCompactLayout = useIsCompactLayout()

  // 1. Local, isolated state for filter bar autocomplete
  const [filterInput, setFilterInput] = useState('')
  const [filterSuggestions, setFilterSuggestions] = useState<string[]>([])
  const [showFilterDropdown, setShowFilterDropdown] = useState(false)

  // 2. Self-contained debounce effect for fetching tag suggestions
  useEffect(() => {
    const normalized = normalizeTag(filterInput)
    if (!normalized) {
      setFilterSuggestions([])
      setShowFilterDropdown(false)
      return
    }
    const timer = setTimeout(() => {
      fetchTagSuggestions(token, normalized)
        .then((tags) => {
          setFilterSuggestions(tags)
          setShowFilterDropdown(tags.length > 0)
        })
        .catch(() => {
          setFilterSuggestions([])
          setShowFilterDropdown(false)
        })
    }, 150)
    return () => clearTimeout(timer)
  }, [filterInput, token])

  // 3. Tag badge interactions
  function addFilterTag(raw: string) {
    const tag = normalizeTag(raw)
    if (tag && !filterTags.includes(tag)) {
      setFilterTags((prev) => [...prev, tag])
      setCurrentPage(1)
    }
    setFilterInput('')
    setFilterSuggestions([])
    setShowFilterDropdown(false)
  }

  function removeFilterTag(tag: string) {
    setFilterTags((prev) => prev.filter((t) => t !== tag))
    setCurrentPage(1)
  }

  function handleFilterKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      addFilterTag(filterInput)
    } else if (e.key === 'Escape') {
      setShowFilterDropdown(false)
    }
  }

  function handleFilterInputChange(value: string) {
    if (value.endsWith(',')) {
      addFilterTag(value.slice(0, -1))
    } else {
      setFilterInput(value)
    }
  }

  // --- Scoped CSS Styles ---
  const inputStyle: React.CSSProperties = {
    padding: '7px 10px',
    borderRadius: 6,
    border: `1px solid ${theme.border}`,
    fontSize: 14,
    background: theme.inputBg,
    color: theme.textPrimary,
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
    <div
      style={{
        marginBottom: 16,
        display: 'flex',
        flexDirection: isCompactLayout ? 'column' : 'row',
        flexWrap: 'wrap',
        alignItems: isCompactLayout ? 'stretch' : 'center',
        gap: 8,
      }}
    >
      <span style={{ fontSize: 13, color: theme.textSecondary, whiteSpace: 'nowrap' }}>
        Filter by tag:
      </span>
      
      {filterTags.map((tag) => (
        <span key={tag} style={chipStyle}>
          #{tag}
          <button
            onClick={() => removeFilterTag(tag)}
            style={chipXStyle}
            aria-label={`Remove filter ${tag}`}
          >
            ×
          </button>
        </span>
      ))}

      <div style={{ position: 'relative', flex: 1, minWidth: isCompactLayout ? 0 : 200, width: isCompactLayout ? '100%' : undefined }}>
        <input
          value={filterInput}
          onChange={(e) => handleFilterInputChange(e.target.value)}
          onKeyDown={handleFilterKeyDown}
          onBlur={() => setTimeout(() => setShowFilterDropdown(false), 150)}
          placeholder="Type a tag and press Enter…"
          style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }}
        />
        
        {showFilterDropdown && (
          <div style={dropdownStyle}>
            {filterSuggestions.map((tag) => (
              <div
                key={tag}
                onMouseDown={() => addFilterTag(tag)}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLDivElement).style.background = theme.surfaceHover
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLDivElement).style.background = theme.dropdownBg
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
  )
}
