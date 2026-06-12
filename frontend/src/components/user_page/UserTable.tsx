import { Link } from 'react-router-dom'
import { UserListItem } from '../../api/client'
import { useTheme } from '../../theme/ThemeContext'

interface UserTableProps {
  users: UserListItem[]
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
  loading?: boolean
}

export function UserTable({
  users,
  currentPage,
  totalPages,
  onPageChange,
  loading = false,
}: UserTableProps) {
  const { theme } = useTheme()

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  }

  const tableStyle: React.CSSProperties = {
    width: '100%',
    borderCollapse: 'collapse',
    background: theme.surface,
    border: `1px solid ${theme.border}`,
    borderRadius: 10,
    overflow: 'hidden',
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
    color: theme.textPrimary,
  }

  const linkStyle: React.CSSProperties = {
    color: theme.link,
    textDecoration: 'none',
    fontWeight: 500,
  }

  const paginationStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    background: theme.surfaceAlt,
    borderRadius: 10,
    border: `1px solid ${theme.border}`,
    flexWrap: 'wrap',
  }

  const paginationButtonStyle: React.CSSProperties = {
    padding: '8px 14px',
    background: theme.bg,
    border: `1px solid ${theme.border}`,
    borderRadius: 6,
    fontSize: 14,
    fontWeight: 500,
    cursor: 'pointer',
    color: theme.textPrimary,
  }

  const pageInfoStyle: React.CSSProperties = {
    color: theme.textSecondary,
    fontSize: 14,
    fontWeight: 500,
  }

  const stateStyle: React.CSSProperties = {
    padding: '20px 16px',
    textAlign: 'center',
    color: theme.textSecondary,
    fontSize: 14,
    background: theme.surfaceAlt,
    border: `1px solid ${theme.border}`,
    borderRadius: 10,
  }

  if (loading) {
    return <div style={stateStyle}>Loading users...</div>
  }

  if (users.length === 0) {
    return <div style={stateStyle}>No users found</div>
  }

  return (
    <div style={containerStyle}>
      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={thStyle}>Username</th>
            <th style={thStyle}>Neighborhood</th>
            <th style={{ ...thStyle, textAlign: 'center' }}>Toys</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.id}>
              <td style={{ ...tdStyle, fontWeight: 500 }}>
                <Link to={`/users/${encodeURIComponent(user.username)}`} style={linkStyle}>
                  {user.username}
                </Link>
              </td>
              <td style={tdStyle}>{user.neighborhood || '—'}</td>
              <td style={{ ...tdStyle, textAlign: 'center' }}>
                <Link to={`/toys?owner=${encodeURIComponent(user.username)}`} style={linkStyle}>
                  {user.toy_count}
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {totalPages > 1 && (
        <div style={paginationStyle}>
          <button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
            style={{ ...paginationButtonStyle, opacity: currentPage === 1 ? 0.5 : 1 }}
          >
            Previous
          </button>
          <span style={pageInfoStyle}>
            Page {currentPage} of {totalPages}
          </span>
          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            style={{ ...paginationButtonStyle, opacity: currentPage === totalPages ? 0.5 : 1 }}
          >
            Next
          </button>
        </div>
      )}
    </div>
  )
}
