// useToysPage.ts
import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  acceptTransfer,
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
  type ToyCreate,
  type ToyUpdate,
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

  // --- 3. Toy Form Modal State ---
  const [formOpen, setFormOpen] = useState(false)
  const [editToy, setEditToy] = useState<Toy | null>(null)
  const [formData, setFormData] = useState<FormData>(emptyForm)
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
    if (currentPage > 1) {
      next.set('page', String(currentPage))
    }
    setSearchParams(next, { replace: true })
  }, [filterTags, showOnlyMyToys, ownerUsername, currentPage, setSearchParams])

  useEffect(() => {
    setLoading(true)
    setError(null)
    fetchToys(token, filterTags, currentPage, PAGE_SIZE, showOnlyMyToys, ownerUsername || undefined)
      .then((data) => {
        setToys(data.items)
        setTotalPages(data.total_pages)
      })
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : 'Failed to load toys'),
      )
      .finally(() => setLoading(false))
  }, [token, filterTags, currentPage, refreshKey, showOnlyMyToys, ownerUsername])

  useEffect(() => {
    refreshMetadata().catch((err: unknown) => {
      setError(err instanceof Error ? err.message : 'Failed to load toy metadata')
    })
  }, [refreshMetadata, refreshKey])

  // --- 8. Form Management Actions ---
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
  }

  function handleFormChange(field: keyof Omit<FormData, 'tags'>, value: string) {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  async function handleFormSubmit(finalTags: string[]) {
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