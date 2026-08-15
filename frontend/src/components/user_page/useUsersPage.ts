import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { fetchUsers, UserListItem } from '../../api/client'

interface UseUsersPageReturn {
  users: UserListItem[]
  currentPage: number
  totalPages: number
  neighborhoods: string[]
  filterNeighborhood: string | null
  searchInput: string
  loading: boolean
  error: string | null
  handleFilterNeighborhood: (neighborhood: string | null) => void
  handleSearch: (search: string) => void
  handlePageChange: (page: number) => void
}

export function useUsersPage(token: string): UseUsersPageReturn {
  const [searchParams, setSearchParams] = useSearchParams()

  const [users, setUsers] = useState<UserListItem[]>([])
  const [totalPages, setTotalPages] = useState(1)
  const [neighborhoods, setNeighborhoods] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filter/page state lives locally so multiple changes made in the same
  // event handler (e.g. "Clear filters") are batched together before being
  // synced to the URL, avoiding a stale-searchParams race.
  const [filterNeighborhood, setFilterNeighborhood] = useState<string | null>(
    () => searchParams.get('neighborhood') || null,
  )
  const [searchInput, setSearchInput] = useState<string>(() => searchParams.get('search') || '')
  const [currentPage, setCurrentPage] = useState<number>(() =>
    parseInt(searchParams.get('page') || '1', 10),
  )

  // Sync all filter/page state to the URL in a single effect so simultaneous
  // updates (e.g. clearing both search and neighborhood) land together.
  useEffect(() => {
    const next = new URLSearchParams()
    if (filterNeighborhood) {
      next.set('neighborhood', filterNeighborhood)
    }
    if (searchInput) {
      next.set('search', searchInput)
    }
    if (currentPage > 1) {
      next.set('page', String(currentPage))
    }
    setSearchParams(next, { replace: true })
  }, [filterNeighborhood, searchInput, currentPage, setSearchParams])

  // Fetch users whenever filters or page changes
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        setError(null)
        const response = await fetchUsers(
          token,
          filterNeighborhood || undefined,
          searchInput || undefined,
          currentPage,
          20,
        )
        setUsers(response.items)
        setTotalPages(response.total_pages)

        // Extract unique neighborhoods from first page
        if (currentPage === 1) {
          const uniqueNeighborhoods = Array.from(
            new Set(
              response.items.map((u) => u.neighborhood).filter((n): n is string => n !== null),
            ),
          ).sort()
          setNeighborhoods(uniqueNeighborhoods)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch users')
      } finally {
        setLoading(false)
      }
    }

    void fetchData()
  }, [token, filterNeighborhood, searchInput, currentPage])

  const handleFilterNeighborhood = (neighborhood: string | null) => {
    setFilterNeighborhood(neighborhood)
    setCurrentPage(1) // Reset to page 1 when filtering
  }

  const handleSearch = (search: string) => {
    setSearchInput(search)
    setCurrentPage(1) // Reset to page 1 when searching
  }

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
  }

  return {
    users,
    currentPage,
    totalPages,
    neighborhoods,
    filterNeighborhood,
    searchInput,
    loading,
    error,
    handleFilterNeighborhood,
    handleSearch,
    handlePageChange,
  }
}
