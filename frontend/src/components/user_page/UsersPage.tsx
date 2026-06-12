import { useUsersPage } from './useUsersPage'
import { UserFilterBar } from './UserFilterBar'
import { UserTable } from './UserTable'
import { useTheme } from '../../theme/ThemeContext'

interface Props {
  token: string
}

export function UsersPage({ token }: Props) {
  const { theme } = useTheme()

  const {
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
  } = useUsersPage(token)

  return (
    <main style={{ padding: '40px 32px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 style={{ margin: 0, color: theme.textPrimary }}>Users</h1>
      </div>

      {error && (
        <div
          style={{
            marginBottom: 16,
            padding: '12px 14px',
            borderRadius: 8,
            border: `1px solid ${theme.error}`,
            background: theme.surfaceAlt,
            color: theme.error,
            fontSize: 14,
          }}
        >
          {error}
        </div>
      )}

      <UserFilterBar
        neighborhoods={neighborhoods}
        selectedNeighborhood={filterNeighborhood}
        searchInput={searchInput}
        onNeighborhoodChange={handleFilterNeighborhood}
        onSearchChange={handleSearch}
      />

      <UserTable
        users={users}
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={handlePageChange}
        loading={loading}
      />
    </main>
  )
}
