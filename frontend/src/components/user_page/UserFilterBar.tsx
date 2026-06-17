import React, { useState } from 'react'
import { useTheme } from '../../theme/ThemeContext'

interface UserFilterBarProps {
  neighborhoods: string[]
  selectedNeighborhood: string | null
  searchInput: string
  onNeighborhoodChange: (neighborhood: string | null) => void
  onSearchChange: (search: string) => void
}

export function UserFilterBar({
  neighborhoods,
  selectedNeighborhood,
  searchInput,
  onNeighborhoodChange,
  onSearchChange,
}: UserFilterBarProps) {
  const { theme } = useTheme()
  const [localSearch, setLocalSearch] = useState(searchInput)

  const handleSearchInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setLocalSearch(value)
    onSearchChange(value)
  }

  const handleClearFilters = () => {
    setLocalSearch('')
    onSearchChange('')
    onNeighborhoodChange(null)
  }

  const hasActiveFilters = selectedNeighborhood !== null || searchInput !== ''

  const filterBarStyle: React.CSSProperties = {
    display: 'flex',
    gap: 12,
    padding: 16,
    marginBottom: 16,
    background: theme.surfaceAlt,
    border: `1px solid ${theme.border}`,
    borderRadius: 10,
    flexWrap: 'wrap',
    alignItems: 'flex-end',
  }

  const filterSectionStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    flex: 1,
    minWidth: 220,
  }

  const labelStyle: React.CSSProperties = {
    fontWeight: 500,
    fontSize: 14,
    color: theme.textSecondary,
  }

  const controlStyle: React.CSSProperties = {
    padding: '8px 12px',
    border: `1px solid ${theme.border}`,
    borderRadius: 6,
    fontSize: 14,
    fontFamily: 'inherit',
    background: theme.inputBg,
    color: theme.textPrimary,
    transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
  }

  const clearButtonStyle: React.CSSProperties = {
    padding: '8px 14px',
    background: theme.bg,
    border: `1px solid ${theme.border}`,
    borderRadius: 6,
    fontSize: 14,
    fontWeight: 500,
    cursor: 'pointer',
    color: theme.textPrimary,
  }

  return (
    <div style={filterBarStyle}>
      <div style={filterSectionStyle}>
        <label htmlFor="search" style={labelStyle}>
          Search by username
        </label>
        <input
          id="search"
          type="text"
          placeholder="Username..."
          value={localSearch}
          onChange={handleSearchInputChange}
          style={controlStyle}
        />
      </div>

      <div style={filterSectionStyle}>
        <label htmlFor="neighborhood" style={labelStyle}>
          Filter by neighborhood
        </label>
        <select
          id="neighborhood"
          value={selectedNeighborhood || ''}
          onChange={(e) => onNeighborhoodChange(e.target.value || null)}
          style={controlStyle}
        >
          <option value="">All neighborhoods</option>
          {neighborhoods.map((neighborhood) => (
            <option key={neighborhood} value={neighborhood}>
              {neighborhood}
            </option>
          ))}
        </select>
      </div>

      {hasActiveFilters && (
        <button onClick={handleClearFilters} style={clearButtonStyle}>
          Clear filters
        </button>
      )}
    </div>
  )
}
