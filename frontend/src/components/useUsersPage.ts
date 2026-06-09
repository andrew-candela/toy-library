import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { fetchUsers, UserListItem } from '../api/client'

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
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [neighborhoods, setNeighborhoods] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Get filter values from URL params
  const filterNeighborhood = searchParams.get('neighborhood') || null
  const searchInput = searchParams.get('search') || ''
  const pageFromUrl = parseInt(searchParams.get('page') || '1', 10)

  useEffect(() => {
    setCurrentPage(pageFromUrl)
  }, [pageFromUrl])

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
              response.items
                .map((u) => u.neighborhood)
                .filter((n): n is string => n !== null),
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

    fetchData()
  }, [token, filterNeighborhood, searchInput, currentPage])

  const handleFilterNeighborhood = (neighborhood: string | null) => {
    const newParams = new URLSearchParams(searchParams)
    if (neighborhood) {
      newParams.set('neighborhood', neighborhood)
    } else {
      newParams.delete('neighborhood')
    }
    newParams.set('page', '1') // Reset to page 1 when filtering
    setSearchParams(newParams)
  }

  const handleSearch = (search: string) => {
    const newParams = new URLSearchParams(searchParams)
    if (search) {
      newParams.set('search', search)
    } else {
      newParams.delete('search')
    }
    newParams.set('page', '1') // Reset to page 1 when searching
    setSearchParams(newParams)
  }

  const handlePageChange = (page: number) => {
    const newParams = new URLSearchParams(searchParams)
    newParams.set('page', String(page))
    setSearchParams(newParams)
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
