import { Link } from 'react-router-dom'
import { useTheme } from '../theme/ThemeContext'

const DEMO_VIDEO_URL = 'https://assets.andrewcandela.com/toy_library_demo.mp4'

export default function DemoPage() {
  const { theme } = useTheme()

  return (
    <main style={{ maxWidth: 720, margin: '80px auto', padding: '0 16px' }}>
      <h1>Toy Library</h1>
      <h2>Demo</h2>
      <p style={{ color: theme.textSecondary, lineHeight: 1.6 }}>
        A short walkthrough of the toy library: browsing toys, borrowing and returning them, and
        managing your account.
      </p>
      {/* preload="metadata" keeps the page from pulling the (large) video down until play. */}
      <video
        controls
        playsInline
        preload="metadata"
        poster="/demo-poster.png"
        src={DEMO_VIDEO_URL}
        style={{
          display: 'block',
          width: '100%',
          aspectRatio: '16 / 9',
          marginTop: 16,
          borderRadius: 6,
          border: `1px solid ${theme.border}`,
          background: theme.imagePlaceholderBg,
        }}
      >
        <p>
          Your browser can't play this video.{' '}
          <a href={DEMO_VIDEO_URL} style={{ color: theme.link }}>
            Download it instead
          </a>
          .
        </p>
      </video>
      <p style={{ marginTop: 24 }}>
        <Link to="/login" style={{ color: theme.link }}>
          Back to sign in
        </Link>
      </p>
    </main>
  )
}
