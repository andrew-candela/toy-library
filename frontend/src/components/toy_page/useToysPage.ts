// useToysPage.ts
import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  acceptTransfer,
  appendToyFormFields,
  cancelTransfer,
  createToy,
  deleteToy,
  deleteInterest,
  expressInterest,
  fetchAllInterests,
  fetchMyToys,
  fetchPendingIncoming,
  fetchToys,
  initiateTransfer,
  updateToy,
  type Toy,
} from '../../api/client'

const PAGE_SIZE = 20

function normalizeTag(raw: string): string {
  return raw.replace(/^#+/, '').trim().toLowerCase()
}

function parsePage(raw: string | null): number {
  if (!raw) return 1
  const parsed = Number(raw)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1
}

export interface ToyFormData {
  title: string
  description: string
  min_age: string
  max_age: string
  image_path: string
  image_file: File | null
  image_preview_url: string | null
  tags: string[]
}

const emptyForm: ToyFormData = {
  title: '',
  description: '',
  min_age: '',
  max_age: '',
  image_path: '',
  image_file: null,
  image_preview_url: null,
  tags: [],
}

export function useToysPage(token: string) {
  const [searchParams, setSearchParams] = useSearchParams()

  // --- 1. Core Core Toy Listing State ---
  const [toys, setToys] = useState<Toy[]>([])
  const [currentPage, setCurrentPage] = useState<number>(() => parsePage(searchParams.get('page')))
  const [totalPages, setTotalPages] = useState(1)
  const [refreshKey, setRefreshKey] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // --- 2. Filter Bar State ---
  const [filterTags, setFilterTags] = useState<string[]>(() => {
    const seen = new Set<string>()
    const initialTags: string[] = []
    for (const rawTag of searchParams.getAll('tags')) {
      const normalized = normalizeTag(rawTag)
      if (normalized && !seen.has(normalized)) {
        seen.add(normalized)
        initialTags.push(normalized)
      }
    }
    return initialTags
  })
  const [filterInput, setFilterInput] = useState('')
  const [showOnlyMyToys, setShowOnlyMyToys] = useState<boolean>(
    () => searchParams.get('my') === '1'
  )
  const [ownerUsername, setOwnerUsername] = useState<string>(
    () => searchParams.get('owner') ?? ''
  )
  const [filterAge, setFilterAge] = useState<string>(
    () => searchParams.get('age') ?? ''
  )
  const [searchQuery, setSearchQuery] = useState<string>(
    () => searchParams.get('q') ?? ''
  )

  // --- 3. Toy Form Modal State ---
  const [formOpen, setFormOpen] = useState(false)
  const [editToy, setEditToy] = useState<Toy | null>(null)
  const [formData, setFormData] = useState<ToyFormData>(emptyForm)
  const [tagInput, setTagInput] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [formLoading, setFormLoading] = useState(false)

  // --- 4. Relational / Metadata State ---
  const [myInterestedToyIds, setMyInterestedToyIds] = useState<Set<number>>(new Set())
  const [interestCountsByToy, setInterestCountsByToy] = useState<Record<number, number>>({})
  const [ownedToyIds, setOwnedToyIds] = useState<Set<number>>(new Set())
  const [pendingIncomingToyIds, setPendingIncomingToyIds] = useState<Set<number>>(new Set())
  const [pendingTransferToByToy, setPendingTransferToByToy] = useState<Record<number, string>>({})
  const [actionLoadingByKey, setActionLoadingByKey] = useState<Record<string, boolean>>({})

  // --- 5. Transfer Modal State ---
  const [transferToy, setTransferToy] = useState<Toy | null>(null)
  const [transferUsername, setTransferUsername] = useState('')
  const [transferError, setTransferError] = useState<string | null>(null)
  const [transferLoading, setTransferLoading] = useState(false)

  // --- 6. Helper Functions for Loading Status ---
  function setActionLoading(key: string, loading: boolean) {
    setActionLoadingByKey((prev) => ({ ...prev, [key]: loading }))
  }
  function isActionLoading(key: string) {
    return Boolean(actionLoadingByKey[key])
  }

  function setFormDataWithPreview(nextFormData: ToyFormData) {
    setFormData((prev) => {
      if (prev.image_preview_url?.startsWith('blob:')) {
        URL.revokeObjectURL(prev.image_preview_url)
      }
      return nextFormData
    })
  }

  function handleImageFileChange(file: File | null) {
    setFormData((prev) => {
      if (prev.image_preview_url?.startsWith('blob:')) {
        URL.revokeObjectURL(prev.image_preview_url)
      }
      if (!file) {
        return {
          ...prev,
          image_file: null,
          image_preview_url: null,
        }
      }
      return {
        ...prev,
        image_file: file,
        image_preview_url: URL.createObjectURL(file),
      }
    })
  }

  // --- 7. Data Sync Effects ---
  const refreshMetadata = useCallback(async () => {
    const [allInterests, myToys, pendingIncoming] = await Promise.all([
      fetchAllInterests(token),
      fetchMyToys(token),
      fetchPendingIncoming(token),
    ])

    const ownedSet = new Set<number>()
    const pendingByToy: Record<number, string> = {}
    for (const userToy of myToys) {
      ownedSet.add(userToy.toy_id)
      if (userToy.pending_user?.username) {
        pendingByToy[userToy.toy_id] = userToy.pending_user.username
      }
    }
    setOwnedToyIds(ownedSet)
    setPendingTransferToByToy(pendingByToy)

    const myInterestSet = new Set<number>()
    const countMap: Record<number, number> = {}
    for (const interest of allInterests) {
      countMap[interest.toy_id] = interest.interested_count
      if (interest.viewer_interested && !ownedSet.has(interest.toy_id)) {
        myInterestSet.add(interest.toy_id)
      }
    }
    setMyInterestedToyIds(myInterestSet)
    setInterestCountsByToy(countMap)

    const incomingSet = new Set<number>()
    for (const userToy of pendingIncoming) {
      incomingSet.add(userToy.toy_id)
    }
    setPendingIncomingToyIds(incomingSet)
  }, [token])

  useEffect(() => {
    const next = new URLSearchParams()
    for (const tag of filterTags) {
      next.append('tags', tag)
    }
    if (showOnlyMyToys) {
      next.set('my', '1')
    }
    if (ownerUsername) {
      next.set('owner', ownerUsername)
    }
    if (filterAge) {
      next.set('age', filterAge)
    }
    if (searchQuery) {
      next.set('q', searchQuery)
    }
    if (currentPage > 1) {
      next.set('page', String(currentPage))
    }
    setSearchParams(next, { replace: true })
  }, [filterTags, showOnlyMyToys, ownerUsername, filterAge, searchQuery, currentPage, setSearchParams])

  useEffect(() => {
    setLoading(true)
    setError(null)
    fetchToys(
      token,
      filterTags,
      currentPage,
      PAGE_SIZE,
      showOnlyMyToys,
      ownerUsername || undefined,
      filterAge ? Number(filterAge) : undefined,
      searchQuery || undefined,
    )
      .then((data) => {
        setToys(data.items)
        setTotalPages(data.total_pages)
      })
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : 'Failed to load toys'),
      )
      .finally(() => setLoading(false))
  }, [token, filterTags, currentPage, refreshKey, showOnlyMyToys, ownerUsername, filterAge, searchQuery])

  useEffect(() => {
    refreshMetadata().catch((err: unknown) => {
      setError(err instanceof Error ? err.message : 'Failed to load toy metadata')
    })
  }, [refreshMetadata, refreshKey])

  // --- 8. Form Management Actions ---
  function openCreate() {
    setEditToy(null)
    setFormDataWithPreview(emptyForm)
    setTagInput('')
    setFormError(null)
    setFormOpen(true)
  }

  function openEdit(toy: Toy) {
    setEditToy(toy)
    setFormDataWithPreview({
      title: toy.title,
      description: toy.description ?? '',
      min_age: toy.min_age?.toString() ?? '',
      max_age: toy.max_age?.toString() ?? '',
      image_path: toy.image_path ?? '',
      image_file: null,
      image_preview_url: null,
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
    setFormDataWithPreview(emptyForm)
  }

  function handleFormChange(
    field: keyof Omit<ToyFormData, 'tags' | 'image_file' | 'image_preview_url'>,
    value: string,
  ) {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  async function handleFormSubmit(finalTags: string[]) {
    setFormLoading(true)
    setFormError(null)
    try {
      const payload = new FormData()
      appendToyFormFields(payload, {
        title: formData.title,
        description: formData.description || undefined,
        min_age: formData.min_age !== '' ? Number(formData.min_age) : undefined,
        max_age: formData.max_age !== '' ? Number(formData.max_age) : undefined,
        tags: finalTags,
      })
      if (formData.image_file) {
        payload.append('image_file', formData.image_file)
      }

      if (editToy) {
        const updated = await updateToy(token, editToy.id, payload)
        setToys((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
      } else {
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

  // --- 9. Toy Resource Interaction Actions ---
  async function handleDelete(toy: Toy) {
    if (!window.confirm(`Delete "${toy.title}"?`)) return
    try {
      await deleteToy(token, toy.id)
      setRefreshKey((k) => k + 1)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Delete failed')
    }
  }

  async function handleExpressInterest(toyId: number) {
    const key = `interest-${toyId}`
    if (isActionLoading(key)) return
    if (ownedToyIds.has(toyId)) return
    setActionLoading(key, true)
    setError(null)
    try {
      await expressInterest(token, toyId)
      setMyInterestedToyIds((prev) => {
        const next = new Set(prev)
        next.add(toyId)
        return next
      })
      setInterestCountsByToy((prev) => ({
        ...prev,
        [toyId]: (prev[toyId] ?? 0) + 1,
      }))
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to express interest')
    } finally {
      setActionLoading(key, false)
    }
  }

  async function handleCancelInterest(toyId: number) {
    const key = `interest-${toyId}`
    if (isActionLoading(key)) return
    if (ownedToyIds.has(toyId)) return
    setActionLoading(key, true)
    setError(null)
    try {
      await deleteInterest(token, toyId)
      setMyInterestedToyIds((prev) => {
        const next = new Set(prev)
        next.delete(toyId)
        return next
      })
      setInterestCountsByToy((prev) => ({
        ...prev,
        [toyId]: Math.max(0, (prev[toyId] ?? 0) - 1),
      }))
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to cancel interest')
    } finally {
      setActionLoading(key, false)
    }
  }

  // --- 10. Transfer Modal Actions ---
  function openTransferModal(toy: Toy) {
    setTransferToy(toy)
    setTransferUsername('')
    setTransferError(null)
  }

  function closeTransferModal() {
    setTransferToy(null)
    setTransferUsername('')
    setTransferError(null)
    setTransferLoading(false)
  }

  async function handleTransferSubmit(toUsername: string) {
    if (!transferToy) return
    setTransferLoading(true)
    setTransferError(null)
    try {
      await initiateTransfer(token, transferToy.id, toUsername)
      await refreshMetadata()
      closeTransferModal()
    } catch (err: unknown) {
      setTransferError(err instanceof Error ? err.message : 'Failed to initiate transfer')
    } finally {
      setTransferLoading(false)
    }
  }

  async function handleCancelTransfer(toyId: number) {
    const key = `transfer-${toyId}`
    if (isActionLoading(key)) return
    setActionLoading(key, true)
    setError(null)
    try {
      await cancelTransfer(token, toyId)
      await refreshMetadata()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to cancel transfer')
    } finally {
      setActionLoading(key, false)
    }
  }

  async function handleAcceptTransfer(toyId: number) {
    const key = `transfer-${toyId}`
    if (isActionLoading(key)) return
    setActionLoading(key, true)
    setError(null)
    try {
      await acceptTransfer(token, toyId)
      await refreshMetadata()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to accept transfer')
    } finally {
      setActionLoading(key, false)
    }
  }

  // --- 11. Expose Everything Needed by the Views ---
  return {
    // Listing/State
    toys,
    loading,
    error,
    currentPage,
    totalPages,
    setCurrentPage,
    
    // Tag Filters
    filterTags,
    setFilterTags,
    filterInput,
    setFilterInput,
    showOnlyMyToys,
    setShowOnlyMyToys,
    ownerUsername,
    setOwnerUsername,
    filterAge,
    setFilterAge,
    searchQuery,
    setSearchQuery,
    
    // Ownership metadata context
    ownedToyIds,
    myInterestedToyIds,
    interestCountsByToy,
    pendingIncomingToyIds,
    pendingTransferToByToy,
    isActionLoading,

    // Form controls
    formOpen,
    editToy,
    formData,
    setFormData,
    tagInput,
    setTagInput,
    formError,
    formLoading,
    handleImageFileChange,
    openCreate,
    openEdit,
    closeForm,
    handleFormChange,
    handleFormSubmit,
    handleDelete,

    // Resource actions
    handleExpressInterest,
    handleCancelInterest,
    handleAcceptTransfer,
    handleCancelTransfer,

    // Transfer Modal
    transferToy,
    transferUsername,
    setTransferUsername,
    transferError,
    transferLoading,
    openTransferModal,
    closeTransferModal,
    handleTransferSubmit,
  }
}