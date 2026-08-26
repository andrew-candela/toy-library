import { Link } from 'react-router-dom'
import { useTheme } from '../theme/ThemeContext'
import { useIsCompactLayout } from '../theme/useIsCompactLayout'

const QUICK_REFERENCE: { tab: string; can: string }[] = [
  { tab: 'Toys', can: 'View, search for, and add toys' },
  { tab: 'Users', can: 'View members and contact them' },
  { tab: 'Profile', can: 'Manage your account and preferences' },
]

export default function HelpPage() {
  const { theme } = useTheme()
  const isCompactLayout = useIsCompactLayout()

  const sectionStyle: React.CSSProperties = {
    marginTop: 36,
  }

  const h2Style: React.CSSProperties = {
    margin: '0 0 8px',
    fontSize: isCompactLayout ? 20 : 22,
    color: theme.textPrimary,
  }

  const h3Style: React.CSSProperties = {
    margin: '20px 0 6px',
    fontSize: isCompactLayout ? 16 : 17,
    color: theme.textPrimary,
  }

  const pStyle: React.CSSProperties = {
    margin: '0 0 8px',
    color: theme.textSecondary,
    lineHeight: 1.6,
  }

  const listStyle: React.CSSProperties = {
    margin: '0 0 8px',
    paddingLeft: 22,
    color: theme.textSecondary,
    lineHeight: 1.6,
  }

  const cellStyle: React.CSSProperties = {
    padding: '10px 14px',
    borderBottom: `1px solid ${theme.border}`,
    textAlign: 'left',
    verticalAlign: 'top',
    color: theme.textSecondary,
  }

  const headerCellStyle: React.CSSProperties = {
    ...cellStyle,
    color: theme.textPrimary,
    fontWeight: 600,
    background: theme.surfaceAlt,
  }

  // Section headings double as shortcuts to the page they describe.
  const headingLinkStyle: React.CSSProperties = {
    color: theme.link,
    textDecoration: 'none',
  }

  return (
    <main style={{ padding: isCompactLayout ? '24px 16px' : '40px 32px' }}>
      <div style={{ maxWidth: 720 }}>
        <p style={{ ...pStyle, color: theme.textMuted }}>
          A quick tour of what each tab does and how to get the most out of the library.
        </p>

        <section style={sectionStyle}>
          <h2 style={h2Style}>
            1.{' '}
            <Link to="/toys" style={headingLinkStyle}>
              Toys tab
            </Link>
          </h2>
          <p style={pStyle}>The Toys tab is where you can view and manage the available toys.</p>

          <h3 style={h3Style}>Search for toys</h3>
          <ul style={listStyle}>
            <li>
              Use the search bar to describe the toy you have in mind, then press Enter. The list
              re-sorts so the closest matches come first.
            </li>
            <li>You can also use the filters at the top of the page to narrow down your search.</li>
          </ul>

          <h3 style={h3Style}>Add a toy</h3>
          <p style={pStyle}>
            To add a toy, select Add Toy. Please provide as much information as possible so other
            members know what to expect.
          </p>
          <p style={pStyle}>Add Toy information:</p>
          <ul style={listStyle}>
            <li>
              <strong style={{ color: theme.textPrimary }}>Title</strong> – If possible, use the
              toy’s actual name or title. If you don’t know it, provide the best description you
              can.
            </li>
            <li>
              <strong style={{ color: theme.textPrimary }}>Min Age</strong> – Enter the youngest
              recommended age.
            </li>
            <li>
              <strong style={{ color: theme.textPrimary }}>Max Age</strong> – Enter the oldest
              recommended age.
            </li>
            <li>
              <strong style={{ color: theme.textPrimary }}>Description</strong> – Include helpful
              details about the toy, such as:
              <ul style={{ ...listStyle, marginTop: 4 }}>
                <li>What the toy does</li>
                <li>Whether it makes noise</li>
                <li>Whether it requires batteries</li>
                <li>The toy’s condition</li>
                <li>Any other important information</li>
              </ul>
            </li>
            <li>
              <strong style={{ color: theme.textPrimary }}>Image</strong> – Add a photo of the toy.
            </li>
          </ul>
          <p style={pStyle}>Once you have completed all the required information, select Save.</p>
        </section>

        <section style={sectionStyle}>
          <h2 style={h2Style}>2. Toy filters</h2>
          <p style={pStyle}>The filters above the toy list let you narrow what you see.</p>

          <h3 style={h3Style}>Suitable for age</h3>
          <p style={pStyle}>
            Enter the age you are looking for to see toys appropriate for that age.
          </p>

          <h3 style={h3Style}>My toys only</h3>
          <p style={pStyle}>Select this option to see only the toys that you have posted.</p>
        </section>

        <section style={sectionStyle}>
          <h2 style={h2Style}>
            3.{' '}
            <Link to="/users" style={headingLinkStyle}>
              Users tab
            </Link>
          </h2>
          <p style={pStyle}>The Users tab shows all members participating in the toy exchange.</p>
          <ul style={listStyle}>
            <li>Select another member’s username to see the toys they are passing along.</li>
          </ul>
          <p style={pStyle}>To contact another member:</p>
          <ol style={listStyle}>
            <li>Click on their username.</li>
            <li>Select the Email button.</li>
            <li>
              This will open a message box so you can contact them directly. This will send them an
              email to their personal email.
            </li>
          </ol>
        </section>

        <section style={sectionStyle}>
          <h2 style={h2Style}>
            4.{' '}
            <Link to="/profile" style={headingLinkStyle}>
              Profile tab
            </Link>
          </h2>
          <p style={pStyle}>
            The Profile tab allows you to manage your personal information and preferences. You can:
          </p>
          <ul style={listStyle}>
            <li>Change your username</li>
            <li>Change your email address</li>
            <li>Add, change, or remove your neighborhood</li>
            <li>Switch the website appearance to Dark Mode</li>
          </ul>
        </section>

        <section style={sectionStyle}>
          <h2 style={h2Style}>Quick reference</h2>
          <div style={{ overflowX: 'auto' }}>
            <table
              style={{
                width: '100%',
                minWidth: 320,
                borderCollapse: 'collapse',
                border: `1px solid ${theme.border}`,
                fontSize: 14,
              }}
            >
              <thead>
                <tr>
                  <th style={headerCellStyle}>Tab</th>
                  <th style={headerCellStyle}>What you can do</th>
                </tr>
              </thead>
              <tbody>
                {QUICK_REFERENCE.map((row) => (
                  <tr key={row.tab}>
                    <td style={{ ...cellStyle, color: theme.textPrimary, fontWeight: 500 }}>
                      {row.tab}
                    </td>
                    <td style={cellStyle}>{row.can}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  )
}
