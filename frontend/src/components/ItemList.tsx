import { useEffect, useState } from 'react'
import { fetchItems, type Item } from '../api/client'

interface Props {
  token: string
}

export default function ItemList({ token }: Props) {
  const [items, setItems] = useState<Item[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchItems(token)
      .then(setItems)
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : 'Failed to load items'),
      )
  }, [token])

  return (
    <main style={{ padding: '40px 32px' }}>
      <h1>Items</h1>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <ul>
        {items.map((item) => (
          <li key={item.id}>
            <strong>{item.title}</strong> — {item.type}
          </li>
        ))}
      </ul>
    </main>
  )
}
