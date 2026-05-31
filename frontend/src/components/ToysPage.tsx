import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  createToy,
  deleteToy,
  fetchTagSuggestions,
  fetchToys,
  updateToy,
  type Toy,
  type ToyCreate,
  type ToyUpdate,
} from '../api/client'
import { useTheme } from '../theme/ThemeContext'

interface Props {
  token: string
}

const PAGE_SIZE = 20

interface FormData {
  title: string
  description: string
  age_range: string
  image_url: string
  tags: string[]
}

const emptyForm: FormData = {
  title: '',
  description: '',
  age_range: '',
  image_url: '',
  tags: [],
}

function normalizeTag(raw: string): string {
  return raw.replace(/^#+/, '').trim().toLowerCase()
}

export default function ToysPage({ token }: Props) {
  const [toys, setToys] = useState<Toy[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [refreshKey, setRefreshKey] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { theme } = useTheme()

  const [filterTags, setFilterTags] = useState<string[]>([])
  const [filterInput, setFilterInput] = useState('')

  const [formOpen, setFormOpen] = useState(false)
  const [editToy, setEditToy] = useState<Toy | null>(null)
  const [formData, setFormData] = useState<FormData>(emptyForm)
  const [tagInput, setTagInput] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [formLoading, setFormLoading] = useState(false)

  const [filterSuggestions, setFilterSuggestions] = useState<string[]>([])
  const [showFilterDropdown, setShowFilterDropdown] = useState(false)
  const [formSuggestions, setFormSuggestions] = useState<string[]>([])
  const [showFormDropdown, setShowFormDropdown] = useState(false)

  useEffect(() => {
    setLoading(true)
    fetchToys(token, filterTags, currentPage, PAGE_SIZE)
      .then((data) => {
        setToys(data.items)
        setTotalPages(data.total_pages)
      })
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : 'Failed to load toys'),
      )
      .finally(() => setLoading(false))
  }, [token, filterTags, currentPage, refreshKey])

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

  // --- filter tag management ---
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

  function openCreate() {
    setEditToy(null)
    setFormData(emptyForm)
    setTagInput('')
    setFormError(null)
    setFormOpen(true)
  }

  function openEdit(toy: Toy) {
    setEditToy(toy)
    setFormData({
      title: toy.title,
      description: toy.description ?? '',
      age_range: toy.age_range ?? '',
      image_url: toy.image_url ?? '',
      tags: [...toy.tags],
    })
    setTagInput('')
    setFormError(null)
    setFormOpen(true)
  }

  function closeForm() {
    setFormOpen(false)
    setEditToy(null)
    setTagInput('')
    setFormError(null)
    setFormSuggestions([])
    setShowFormDropdown(false)
  }

  function handleChange(field: keyof Omit<FormData, 'tags'>, value: string) {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    // flush any pending tag input on submit
    const pendingTag = normalizeTag(tagInput)
    const finalTags =
      pendingTag && !formData.tags.includes(pendingTag)
        ? [...formData.tags, pendingTag]
        : formData.tags
    setFormLoading(true)
    setFormError(null)
    try {
      if (editToy) {
        const payload: ToyUpdate = {
          title: formData.title,
          description: formData.description || undefined,
          age_range: formData.age_range || undefined,
          image_url: formData.image_url || undefined,
          tags: finalTags,
        }
        const updated = await updateToy(token, editToy.id, payload)
        setToys((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
      } else {
        const payload: ToyCreate = {
          title: formData.title,
          description: formData.description || undefined,
          age_range: formData.age_range || undefined,
          image_url: formData.image_url || undefined,
          tags: finalTags,
        }
        const created = await createToy(token, payload)
        setToys((prev) => [...prev, created])
        setRefreshKey((k) => k + 1)
      }
      closeForm()
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setFormLoading(false)
    }
  }

  async function handleDelete(toy: Toy) {
    if (!window.confirm(`Delete "${toy.title}"?`)) return
    try {
      await deleteToy(token, toy.id)
      setRefreshKey((k) => k + 1)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Delete failed')
    }
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
    <main style={{ padding: '40px 32px' }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ margin: 0 }}>Toys</h1>
        <button style={{ ...primaryBtnStyle, marginLeft: 'auto' }} onClick={openCreate}>
          + Add Toy
        </button>
      </div>

      {/* Tag filter bar */}
      <div
        style={{
          marginBottom: 16,
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <span style={{ fontSize: 13, color: theme.textSecondary, whiteSpace: 'nowrap' }}>Filter by tag:</span>
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
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
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

      {formOpen && (
        <form
          onSubmit={handleSubmit}
          style={{
            background: theme.surfaceAlt,
            border: `1px solid ${theme.border}`,
            borderRadius: 8,
            padding: '20px 24px',
            marginBottom: 24,
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 12,
            maxWidth: 640,
          }}
        >
          <h3 style={{ margin: 0, gridColumn: '1 / -1' }}>{editToy ? 'Edit Toy' : 'New Toy'}</h3>

          <label style={labelStyle}>
            Title *
            <input
              value={formData.title}
              onChange={(e) => handleChange('title', e.target.value)}
              required
              style={inputStyle}
            />
          </label>

          <label style={labelStyle}>
            Age Range
            <input
              value={formData.age_range}
              onChange={(e) => handleChange('age_range', e.target.value)}
              style={inputStyle}
            />
          </label>

          <label style={{ ...labelStyle, gridColumn: '1 / -1' }}>
            Description
            <input
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              style={inputStyle}
            />
          </label>

          <label style={{ ...labelStyle, gridColumn: '1 / -1' }}>
            Image URL
            <input
              value={formData.image_url}
              onChange={(e) => handleChange('image_url', e.target.value)}
              style={inputStyle}
              placeholder="https://example.com/image.jpg"
            />
          </label>

          {formData.image_url && (
            <div style={{ gridColumn: '1 / -1' }}>
              <img
                src={formData.image_url}
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
                placeholder={
                  formData.tags.length === 0 ? 'Type a tag, then Enter or comma…' : ''
                }
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

          <div style={{ display: 'flex', gap: 8, gridColumn: '1 / -1' }}>
            <button type="submit" disabled={formLoading} style={primaryBtnStyle}>
              {formLoading ? 'Saving…' : 'Save'}
            </button>
            <button type="button" onClick={closeForm} style={btnStyle}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {error && <p style={{ color: theme.error }}>{error}</p>}
      {loading && <p style={{ color: theme.textMuted }}>Loading…</p>}

      {!loading && (
        <>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ ...thStyle, width: 64 }}>Image</th>
              <th style={thStyle}>Title</th>
              <th style={thStyle}>Tags</th>
              <th style={thStyle}>Age Range</th>
              <th style={thStyle}>Items</th>
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
            {toys.map((toy) => (
              <tr key={toy.id}>
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
                <td style={tdStyle}><Link to={`/toys/${toy.id}`} style={{ color: theme.link, textDecoration: 'none', fontWeight: 500 }}>{toy.title}</Link></td>
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
                          onClick={() => {
                            if (!filterTags.includes(tag)) {
                              setFilterTags((prev) => [...prev, tag])
                            }
                          }}
                        >
                          #{tag}
                        </span>
                      ))
                    )}
                  </div>
                </td>
                <td style={tdStyle}>{toy.age_range ?? '—'}</td>
                <td style={tdStyle}>
                  <Link to={`/items?toyId=${toy.id}`}>View Items</Link>
                </td>
                <td style={tdStyle}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button style={btnStyle} onClick={() => openEdit(toy)}>
                      Edit
                    </button>
                    <button
                      style={{ ...btnStyle, color: theme.danger }}
                      onClick={() => handleDelete(toy)}
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Pagination controls */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 16 }}>
            <button
              style={{ ...btnStyle, opacity: currentPage === 1 ? 0.5 : 1 }}
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => p - 1)}
            >
              Previous
            </button>
            <span style={{ fontSize: 14, color: theme.textSecondary }}>
              Page {currentPage} of {totalPages}
            </span>
            <button
              style={{ ...btnStyle, opacity: currentPage === totalPages ? 0.5 : 1 }}
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((p) => p + 1)}
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

