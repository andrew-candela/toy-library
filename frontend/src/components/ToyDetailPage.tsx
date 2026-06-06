import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { fetchToy, type Toy } from '../api/client'
import { useTheme } from '../theme/ThemeContext'

interface Props {
  token: string
}

export default function ToyDetailPage({ token }: Props) {
  const { id } = useParams<{ id: string }>()
  const [toy, setToy] = useState<Toy | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { theme } = useTheme()

  useEffect(() => {
    if (!id) return
    fetchToy(token, Number(id))
      .then(setToy)
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : 'Failed to load toy'),
      )
      .finally(() => setLoading(false))
  }, [token, id])

  const chipStyle: React.CSSProperties = {
    display: 'inline-block',
    padding: '3px 10px',
    borderRadius: 12,
    background: theme.chipBg,
    color: theme.chipText,
    fontSize: 13,
    fontWeight: 500,
  }

  const labelStyle: React.CSSProperties = {
    fontSize: 13,
    color: theme.textMuted,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: 4,
  }

  return (
    <main style={{ padding: '40px 32px', maxWidth: 720 }}>
      <Link
        to="/toys"
        style={{ fontSize: 14, color: theme.link, textDecoration: 'none', display: 'inline-block', marginBottom: 24 }}
      >
        ← Back to Toys
      </Link>

      {loading && <p style={{ color: theme.textMuted }}>Loading…</p>}
      {error && <p style={{ color: theme.error }}>{error}</p>}

      {toy && (
        <>
          <div style={{ display: 'flex', gap: 32, alignItems: 'flex-start', marginBottom: 32 }}>
            {toy.image_url && (
              <img
                src={toy.image_url}
                alt={toy.title}
                style={{ width: 180, height: 180, objectFit: 'cover', borderRadius: 10, border: `1px solid ${theme.border}`, flexShrink: 0 }}
              />
            )}
            <div style={{ flex: 1 }}>
              <h1 style={{ margin: '0 0 8px 0' }}>{toy.title}</h1>

              {toy.age_range && (
                <div style={{ marginBottom: 12 }}>
                  <div style={labelStyle}>Age Range</div>
                  <span style={{ fontSize: 15 }}>{toy.age_range}</span>
                </div>
              )}

              {toy.description && (
                <div style={{ marginBottom: 12 }}>
                  <div style={labelStyle}>Description</div>
                  <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6, color: theme.textSecondary }}>{toy.description}</p>
                </div>
              )}

              {toy.tags.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div style={labelStyle}>Tags</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {toy.tags.map((tag) => (
                      <span key={tag} style={chipStyle}>#{tag}</span>
                    ))}
                  </div>
                </div>
              )}

            </div>
          </div>
        </>
      )}
    </main>
  )
}
