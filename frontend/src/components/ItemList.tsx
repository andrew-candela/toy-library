import { useEffect, useState } from 'react'
import React from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  acceptTransfer,
  cancelTransfer,
  createItem,
  deleteItem,
  deleteInterest,
  expressInterest,
  fetchAllInterests,
  fetchInterests,
  fetchItems,
  fetchMyItems,
  fetchPendingIncoming,
  fetchTagSuggestions,
  fetchToys,
  getProfile,
  initiateTransfer,
  updateItem,
  type FetchItemsParams,
  type Interest,
  type Item,
  type ItemCondition,
  type Toy,
  type UserItem,
} from '../api/client'

interface Props {
  token: string
}

const PAGE_SIZE = 20

export default function ItemList({ token }: Props) {
  const [items, setItems] = useState<Item[]>([])
  const [myItems, setMyItems] = useState<UserItem[]>([])
  const [pendingIncoming, setPendingIncoming] = useState<UserItem[]>([])
  const [toys, setToys] = useState<Toy[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [formOpen, setFormOpen] = useState(false)
  const [editItem, setEditItem] = useState<Item | null>(null)
  const [toyId, setToyId] = useState<string>('')
  const [condition, setCondition] = useState<string>('')
  const [formError, setFormError] = useState<string | null>(null)
  const [formLoading, setFormLoading] = useState(false)

  // --- filter state ---
  const [showMyItemsOnly, setShowMyItemsOnly] = useState(false)
  const [filterTags, setFilterTags] = useState<string[]>([])
  const [filterInput, setFilterInput] = useState('')
  const [filterSuggestions, setFilterSuggestions] = useState<string[]>([])
  const [showFilterDropdown, setShowFilterDropdown] = useState(false)
  const [neighborhoodSearch, setNeighborhoodSearch] = useState('')
  const [toySearch, setToySearch] = useState('')

  // --- pagination state ---
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [refreshKey, setRefreshKey] = useState(0)

  // --- debounced text search ---
  const [debouncedNeighborhood, setDebouncedNeighborhood] = useState('')
  const [debouncedToySearch, setDebouncedToySearch] = useState('')

  const [searchParams, setSearchParams] = useSearchParams()
  const toyIdParam = searchParams.get('toyId')

  const myItemsMap = new Map(myItems.map((ui) => [ui.item_id, ui]))
  const pendingIncomingMap = new Map(pendingIncoming.map((ui) => [ui.item_id, ui]))

  // Interest state
  const [interests, setInterests] = useState<Map<number, Interest[]>>(new Map())
  const [interestLoadingIds, setInterestLoadingIds] = useState<Set<number>>(new Set())
  const [currentUserId, setCurrentUserId] = useState<number | null>(null)

  // Transfer state
  const [transferringItemId, setTransferringItemId] = useState<number | null>(null)
  const [transferUsername, setTransferUsername] = useState('')
  const [transferLoading, setTransferLoading] = useState(false)
  const [transferError, setTransferError] = useState<string | null>(null)
  const [cancelLoadingId, setCancelLoadingId] = useState<number | null>(null)
  const [acceptLoadingId, setAcceptLoadingId] = useState<number | null>(null)
  const [acceptError, setAcceptError] = useState<{ [itemId: number]: string }>({})

  async function refreshTransferState() {
    const itemParams: FetchItemsParams = {
      page: currentPage,
      pageSize: PAGE_SIZE,
      neighborhood: debouncedNeighborhood || undefined,
      toyTitle: debouncedToySearch || undefined,
      tags: filterTags,
      myItemsOnly: showMyItemsOnly,
      toyId: toyIdParam ? Number(toyIdParam) : undefined,
    }
    const [itemsData, refreshedMyItems, refreshedPendingIncoming] = await Promise.all([
      fetchItems(token, itemParams),
      fetchMyItems(token),
      fetchPendingIncoming(token),
    ])
    setItems(itemsData.items)
    setMyItems(refreshedMyItems)
    setPendingIncoming(refreshedPendingIncoming)
  }

  // --- filter tag helpers ---
  function normalizeTag(raw: string): string {
    return raw.replace(/^#+/, '').trim().toLowerCase()
  }

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
    const timer = setTimeout(() => {
      setDebouncedNeighborhood(neighborhoodSearch)
      setCurrentPage(1)
    }, 400)
    return () => clearTimeout(timer)
  }, [neighborhoodSearch])

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedToySearch(toySearch)
      setCurrentPage(1)
    }, 400)
    return () => clearTimeout(timer)
  }, [toySearch])

  // One-time setup: load toys (for create-item dropdown), profile, and all interests
  useEffect(() => {
    Promise.all([fetchToys(token, [], 1, 100), getProfile(token), fetchAllInterests(token)])
      .then(([toysData, profile, allInterests]) => {
        setToys(toysData.items)
        setCurrentUserId(profile.id)
        const interestMap = new Map<number, Interest[]>()
        for (const interest of allInterests) {
          const existing = interestMap.get(interest.item_id) ?? []
          existing.push(interest)
          interestMap.set(interest.item_id, existing)
        }
        setInterests(interestMap)
      })
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : 'Failed to load'),
      )
  }, [token])

  // Paginated items fetch — re-runs whenever filters or page change
  useEffect(() => {
    setLoading(true)
    Promise.all([
      fetchItems(token, {
        page: currentPage,
        pageSize: PAGE_SIZE,
        neighborhood: debouncedNeighborhood || undefined,
        toyTitle: debouncedToySearch || undefined,
        tags: filterTags,
        myItemsOnly: showMyItemsOnly,
        toyId: toyIdParam ? Number(toyIdParam) : undefined,
      }),
      fetchMyItems(token),
      fetchPendingIncoming(token),
    ])
      .then(([itemsData, fetchedMyItems, fetchedPendingIncoming]) => {
        setItems(itemsData.items)
        setTotalPages(itemsData.total_pages)
        setMyItems(fetchedMyItems)
        setPendingIncoming(fetchedPendingIncoming)
      })
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : 'Failed to load'),
      )
      .finally(() => setLoading(false))
  }, [token, currentPage, debouncedNeighborhood, debouncedToySearch, filterTags, showMyItemsOnly, toyIdParam, refreshKey])

  function openCreate() {
    setEditItem(null)
    setToyId('')
    setCondition('')
    setFormError(null)
    setFormOpen(true)
  }

  function openEdit(item: Item) {
    setEditItem(item)
    setToyId(String(item.toy_id))
    setCondition(item.condition)
    setFormError(null)
    setFormOpen(true)
  }

  function closeForm() {
    setFormOpen(false)
    setEditItem(null)
    setFormError(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!toyId || !condition) {
      setFormError('Toy and condition are required.')
      return
    }
    setFormLoading(true)
    setFormError(null)
    try {
      if (editItem) {
        const updated = await updateItem(token, editItem.id, {
          toy_id: Number(toyId),
          condition: condition as ItemCondition,
        })
        setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)))
      } else {
        await createItem(token, {
          toy_id: Number(toyId),
          condition: condition as ItemCondition,
        })
        setRefreshKey((k) => k + 1)
      }
      closeForm()
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setFormLoading(false)
    }
  }

  async function handleDelete(item: Item) {
    if (!window.confirm(`Delete item for "${item.toy.title}"?`)) return
    try {
      await deleteItem(token, item.id)
      setRefreshKey((k) => k + 1)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Delete failed')
    }
  }

  function openTransferForm(itemId: number) {
    setTransferringItemId(itemId)
    setTransferUsername('')
    setTransferError(null)
  }

  function closeTransferForm() {
    setTransferringItemId(null)
    setTransferUsername('')
    setTransferError(null)
  }

  async function handleExpressInterest(itemId: number) {
    setInterestLoadingIds((prev) => new Set(prev).add(itemId))
    try {
      const interest = await expressInterest(token, itemId)
      setInterests((prev) => {
        const next = new Map(prev)
        next.set(itemId, [...(prev.get(itemId) ?? []), interest])
        return next
      })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to express interest')
    } finally {
      setInterestLoadingIds((prev) => {
        const s = new Set(prev)
        s.delete(itemId)
        return s
      })
    }
  }

  async function handleDeleteInterest(itemId: number) {
    setInterestLoadingIds((prev) => new Set(prev).add(itemId))
    try {
      await deleteInterest(token, itemId)
      setInterests((prev) => {
        const next = new Map(prev)
        next.set(itemId, (prev.get(itemId) ?? []).filter((i) => i.user.id !== currentUserId))
        return next
      })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to remove interest')
    } finally {
      setInterestLoadingIds((prev) => {
        const s = new Set(prev)
        s.delete(itemId)
        return s
      })
    }
  }

  async function handleInitiateTransfer(e: React.FormEvent, itemId: number) {
    e.preventDefault()
    if (!transferUsername.trim()) {
      setTransferError('Username is required.')
      return
    }
    setTransferLoading(true)
    setTransferError(null)
    try {
      await initiateTransfer(token, itemId, transferUsername.trim())
      closeTransferForm()
      await refreshTransferState()
    } catch (err: unknown) {
      setTransferError(err instanceof Error ? err.message : 'Transfer failed')
    } finally {
      setTransferLoading(false)
    }
  }

  async function handleCancelTransfer(itemId: number) {
    setCancelLoadingId(itemId)
    try {
      await cancelTransfer(token, itemId)
      await refreshTransferState()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Cancel failed')
    } finally {
      setCancelLoadingId(null)
    }
  }

  async function handleAcceptTransfer(itemId: number) {
    setAcceptLoadingId(itemId)
    setAcceptError((prev) => ({ ...prev, [itemId]: '' }))
    try {
      await acceptTransfer(token, itemId)
      await refreshTransferState()
      // Backend clears the recipient's interest on accept — refresh to reflect that
      const updatedInterests = await fetchInterests(token, itemId)
      setInterests((prev) => new Map(prev).set(itemId, updatedInterests))
    } catch (err: unknown) {
      setAcceptError((prev) => ({
        ...prev,
        [itemId]: err instanceof Error ? err.message : 'Accept failed',
      }))
    } finally {
      setAcceptLoadingId(null)
    }
  }

  const btnStyle: React.CSSProperties = {
    padding: '6px 14px',
    borderRadius: 6,
    border: '1px solid #e4e4e7',
    background: '#fff',
    cursor: 'pointer',
    fontSize: 14,
  }

  const primaryBtnStyle: React.CSSProperties = {
    ...btnStyle,
    background: '#111',
    color: '#fff',
    border: 'none',
  }

  const selectStyle: React.CSSProperties = {
    padding: '7px 10px',
    borderRadius: 6,
    border: '1px solid #e4e4e7',
    fontSize: 14,
  }

  const labelStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    fontSize: 14,
  }

  const inputStyle: React.CSSProperties = {
    padding: '7px 10px',
    borderRadius: 6,
    border: '1px solid #e4e4e7',
    fontSize: 14,
  }

  const chipStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    padding: '2px 8px',
    borderRadius: 12,
    background: '#e8f0fe',
    color: '#1a56db',
    fontSize: 12,
    fontWeight: 500,
  }

  const chipXStyle: React.CSSProperties = {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: 0,
    lineHeight: 1,
    color: '#1a56db',
    fontSize: 14,
  }

  const dropdownStyle: React.CSSProperties = {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    zIndex: 100,
    background: '#fff',
    border: '1px solid #e4e4e7',
    borderRadius: 6,
    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
    marginTop: 2,
    overflow: 'hidden',
  }

  const thStyle: React.CSSProperties = {
    textAlign: 'left',
    padding: '8px 12px',
    borderBottom: '2px solid #e4e4e7',
    fontWeight: 600,
    fontSize: 13,
    color: '#555',
  }

  const tdStyle: React.CSSProperties = {
    padding: '8px 12px',
    borderBottom: '1px solid #f0f0f0',
    fontSize: 14,
  }

  return (
    <main style={{ padding: '40px 32px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <h1 style={{ margin: 0 }}>Items</h1>
        <button style={{ ...primaryBtnStyle, marginLeft: 'auto' }} onClick={openCreate}>
          + Add Item
        </button>
      </div>

      {/* Filter bar */}
      <div style={{ marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Row 1: My Items toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={() => {
            setShowMyItemsOnly((prev) => !prev)
            setCurrentPage(1)
          }}
            style={{
              ...btnStyle,
              background: showMyItemsOnly ? '#111' : '#fff',
              color: showMyItemsOnly ? '#fff' : '#111',
              border: showMyItemsOnly ? 'none' : '1px solid #e4e4e7',
            }}
          >
            My Items
          </button>
        </div>

        {/* Row 2: Tag filter */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13, color: '#555', whiteSpace: 'nowrap' }}>Filter by tag:</span>
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
                    onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = '#f5f5f5' }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = '#fff' }}
                    style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 13 }}
                  >
                    #{tag}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Row 3: Neighborhood + Toy text search */}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <input
            value={neighborhoodSearch}
            onChange={(e) => setNeighborhoodSearch(e.target.value)}
            placeholder="Search by neighborhood…"
            style={{ ...inputStyle, minWidth: 200, flex: 1 }}
          />
          <input
            value={toySearch}
            onChange={(e) => setToySearch(e.target.value)}
            placeholder="Search by toy…"
            style={{ ...inputStyle, minWidth: 200, flex: 1 }}
          />
        </div>
      </div>

      {formOpen && (
        <form
          onSubmit={handleSubmit}
          style={{
            background: '#f9f9fb',
            border: '1px solid #e4e4e7',
            borderRadius: 8,
            padding: '20px 24px',
            marginBottom: 24,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            maxWidth: 480,
          }}
        >
          <h3 style={{ margin: 0 }}>{editItem ? 'Edit Item' : 'New Item'}</h3>

          <label style={labelStyle}>
            Toy *
            <select
              value={toyId}
              onChange={(e) => setToyId(e.target.value)}
              required
              style={selectStyle}
            >
              <option value="">Select a toy…</option>
              {toys.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </select>
          </label>

          <label style={labelStyle}>
            Condition *
            <select
              value={condition}
              onChange={(e) => setCondition(e.target.value)}
              required
              style={selectStyle}
            >
              <option value="">Select condition…</option>
              <option value="new">New</option>
              <option value="like_new">Like New</option>
              <option value="good">Good</option>
              <option value="fair">Fair</option>
              <option value="poor">Poor</option>
            </select>
          </label>

          {formError && (
            <p style={{ margin: 0, color: 'red', fontSize: 13 }}>{formError}</p>
          )}

          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit" disabled={formLoading} style={primaryBtnStyle}>
              {formLoading ? 'Saving…' : 'Save'}
            </button>
            <button type="button" onClick={closeForm} style={btnStyle}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {error && <p style={{ color: 'red' }}>{error}</p>}
      {loading && <p style={{ color: '#888' }}>Loading…</p>}

      {!loading && (
        <>
          {toyIdParam && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginBottom: 12,
                padding: '8px 12px',
                background: '#e8f0fe',
                borderRadius: 6,
                fontSize: 14,
              }}
            >
              <span>
                Filtered by toy:{' '}
                <strong>
                  {toys.find((t) => t.id === Number(toyIdParam))?.title ?? toyIdParam}
                </strong>
              </span>
              <button
                onClick={() => setSearchParams({})}
                style={{
                  marginLeft: 'auto',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 18,
                  lineHeight: 1,
                  color: '#1a56db',
                }}
                aria-label="Clear filter"
              >
                ×
              </button>
            </div>
          )}
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={thStyle}>Toy</th>
                <th style={thStyle}>Owner</th>
                <th style={thStyle}>Neighborhood</th>
                <th style={thStyle}>Checked Out At</th>
                <th style={thStyle}>Interested</th>
                <th style={thStyle}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ ...tdStyle, color: '#888' }}>
                    {toyIdParam ? 'No items for this toy.' : 'No items yet.'}
                  </td>
                </tr>
              )}
              {items.map((item) => {
                const myUserItem = myItemsMap.get(item.id)
                const incomingUserItem = pendingIncomingMap.get(item.id)
                const isOwned = Boolean(myUserItem)
                const isIncoming = Boolean(incomingUserItem)
                return (
                  <React.Fragment key={item.id}>
                    <tr>
                      <td style={tdStyle}>
                        <Link
                          to={`/toys/${item.toy.id}`}
                          style={{ color: '#1a56db', textDecoration: 'none', fontWeight: 500 }}
                        >
                          {item.toy.title}
                        </Link>
                      </td>
                      <td style={tdStyle}>{item.owner?.username ?? '—'}</td>
                      <td style={tdStyle}>{item.owner?.neighborhood ?? '—'}</td>
                      <td style={tdStyle}>
                        {myUserItem
                          ? new Date(myUserItem.checked_out_at).toLocaleDateString()
                          : '—'}
                      </td>
                      <td style={tdStyle}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-start' }}>
                          {(interests.get(item.id) ?? []).length > 0 ? (
                            <div style={{ fontSize: 12, color: '#555' }}>
                              {(interests.get(item.id) ?? []).map((i) => i.user.username).join(', ')}
                            </div>
                          ) : (
                            <span style={{ fontSize: 12, color: '#aaa' }}>None</span>
                          )}
                          {!isOwned && (() => {
                            const isInterested = (interests.get(item.id) ?? []).some(
                              (i) => i.user.id === currentUserId,
                            )
                            const loading = interestLoadingIds.has(item.id)
                            return isInterested ? (
                              <button
                                style={{ ...btnStyle, color: '#c00', fontSize: 12, padding: '4px 10px' }}
                                disabled={loading}
                                onClick={() => handleDeleteInterest(item.id)}
                              >
                                {loading ? '…' : 'Remove Interest'}
                              </button>
                            ) : (
                              <button
                                style={{ ...btnStyle, fontSize: 12, padding: '4px 10px' }}
                                disabled={loading}
                                onClick={() => handleExpressInterest(item.id)}
                              >
                                {loading ? '…' : 'Interested?'}
                              </button>
                            )
                          })()}
                        </div>
                      </td>
                      <td style={tdStyle}>
                        {isOwned ? (
                          myUserItem!.pending_user ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                              <span
                                style={{
                                  fontSize: 12,
                                  fontWeight: 600,
                                  padding: '3px 8px',
                                  borderRadius: 12,
                                  background: '#fef3c7',
                                  color: '#92400e',
                                  border: '1px solid #fde68a',
                                }}
                              >
                                Pending → {myUserItem!.pending_user.username}
                              </span>
                              <button
                                style={{ ...btnStyle, color: '#c00' }}
                                disabled={cancelLoadingId === item.id}
                                onClick={() => handleCancelTransfer(item.id)}
                              >
                                {cancelLoadingId === item.id ? 'Cancelling…' : 'Cancel'}
                              </button>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button style={btnStyle} onClick={() => openEdit(item)}>
                                Edit
                              </button>
                              <button
                                style={{ ...btnStyle, color: '#c00' }}
                                onClick={() => handleDelete(item)}
                              >
                                Delete
                              </button>
                              <button
                                style={btnStyle}
                                onClick={() => openTransferForm(item.id)}
                              >
                                Transfer
                              </button>
                            </div>
                          )
                        ) : isIncoming ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
                            <button
                              style={primaryBtnStyle}
                              disabled={acceptLoadingId === item.id}
                              onClick={() => handleAcceptTransfer(item.id)}
                            >
                              {acceptLoadingId === item.id ? 'Accepting…' : 'Accept'}
                            </button>
                            {acceptError[item.id] && (
                              <span style={{ fontSize: 12, color: '#c00' }}>{acceptError[item.id]}</span>
                            )}
                          </div>
                        ) : null}
                      </td>
                    </tr>
                    {isOwned && transferringItemId === item.id && (
                      <tr key={`${item.id}-transfer`}>
                        <td
                          colSpan={6}
                          style={{
                            ...tdStyle,
                            background: '#f9f9fb',
                            borderBottom: '2px solid #e4e4e7',
                          }}
                        >
                          <form
                            onSubmit={(e) => handleInitiateTransfer(e, item.id)}
                            style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '4px 0' }}
                          >
                            <label style={{ fontSize: 13, color: '#555' }}>Transfer to username:</label>
                            <input
                              type="text"
                              value={transferUsername}
                              onChange={(e) => setTransferUsername(e.target.value)}
                              placeholder="Enter username…"
                              style={{
                                padding: '6px 10px',
                                borderRadius: 6,
                                border: '1px solid #e4e4e7',
                                fontSize: 14,
                                minWidth: 180,
                              }}
                            />
                            <button type="submit" disabled={transferLoading} style={primaryBtnStyle}>
                              {transferLoading ? 'Sending…' : 'Send'}
                            </button>
                            <button type="button" onClick={closeTransferForm} style={btnStyle}>
                              Cancel
                            </button>
                            {transferError && (
                              <span style={{ fontSize: 12, color: '#c00', width: '100%' }}>{transferError}</span>
                            )}
                          </form>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                )
              })}
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
              <span style={{ fontSize: 14, color: '#555' }}>
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
