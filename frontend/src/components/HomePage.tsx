import { useTheme } from '../theme/ThemeContext'
import { useIsCompactLayout } from '../theme/useIsCompactLayout'

const quotes = [
  {
    text: 'Play is often talked about as if it were a relief from serious learning. But for children play is serious learning. Play is really the work of childhood.',
    attribution: 'Fred Rogers',
  },
  {
    text: 'Toys are not as innocent as they look. Toys and games are the prelude to serious ideas.',
    attribution: 'Charles Eames',
  },
  {
    text: 'PICK UP YOUR DAMN LEGOS!!!',
    attribution: 'You, probably. Definitely me sometimes',
  },
]

export default function HomePage() {
  const { theme } = useTheme()
  const isCompactLayout = useIsCompactLayout()
  return (
    <main style={{ padding: isCompactLayout ? '24px 16px' : '40px 32px' }}>
      <h1>Toy Library Home</h1>
      <section style={{ marginTop: '32px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {quotes.map((q, i) => (
          <blockquote
            key={i}
            style={{
              margin: 0,
              padding: '16px 20px',
              borderLeft: `4px solid ${theme.blockquoteBorder}`,
              background: theme.blockquoteBg,
              borderRadius: '4px',
              fontStyle: 'italic',
            }}
          >
            <p style={{ margin: '0 0 8px' }}>{q.text}</p>
            <footer
              style={{ fontStyle: 'normal', fontSize: '0.875rem', color: theme.textSecondary }}
            >
              — <cite>{q.attribution}</cite>
            </footer>
          </blockquote>
        ))}
      </section>
    </main>
  )
}
