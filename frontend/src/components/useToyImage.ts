import { useEffect, useState } from 'react'
import { fetchImage } from '../api/client'

interface UseToyImageOptions {
  enabled?: boolean
}

interface UseToyImageResult {
  imageSrc: string | null
  loading: boolean
  error: string | null
}

const MAX_CACHE_ENTRIES = 200
const imageUrlCache = new Map<string, string>()
const inFlightImageRequests = new Map<string, Promise<string>>()

function revokeBlobUrl(url: string | null) {
  if (url?.startsWith('blob:')) {
    URL.revokeObjectURL(url)
  }
}

function buildCacheKey(token: string, imagePath: string): string {
  return `${token}:${imagePath}`
}

function touchCacheEntry(key: string): string | null {
  const url = imageUrlCache.get(key)
  if (!url) return null
  imageUrlCache.delete(key)
  imageUrlCache.set(key, url)
  return url
}

function evictLeastRecentlyUsedIfNeeded() {
  while (imageUrlCache.size > MAX_CACHE_ENTRIES) {
    const oldestKey = imageUrlCache.keys().next().value
    if (!oldestKey) return
    const oldestUrl = imageUrlCache.get(oldestKey) ?? null
    imageUrlCache.delete(oldestKey)
    revokeBlobUrl(oldestUrl)
  }
}

async function resolveCachedImageUrl(token: string, imagePath: string): Promise<string> {
  const key = buildCacheKey(token, imagePath)
  const cachedUrl = touchCacheEntry(key)
  if (cachedUrl) {
    return cachedUrl
  }

  const existingRequest = inFlightImageRequests.get(key)
  if (existingRequest) {
    return existingRequest
  }

  const request = (async () => {
    const blob = await fetchImage(token, imagePath)
    if (!blob.type.startsWith('image/')) {
      throw new Error(`Expected image data but received: ${blob.type || 'unknown type'}`)
    }

    const objectUrl = URL.createObjectURL(blob)
    const staleUrl = imageUrlCache.get(key) ?? null
    imageUrlCache.set(key, objectUrl)
    if (staleUrl && staleUrl !== objectUrl) {
      revokeBlobUrl(staleUrl)
    }
    evictLeastRecentlyUsedIfNeeded()
    return objectUrl
  })()

  inFlightImageRequests.set(key, request)
  try {
    return await request
  } finally {
    inFlightImageRequests.delete(key)
  }
}

export function useToyImage(
  token: string,
  imagePath: string | null | undefined,
  options: UseToyImageOptions = {},
): UseToyImageResult {
  const [imageSrc, setImageSrc] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const enabled = options.enabled ?? true

  useEffect(() => {
    let cancelled = false

    if (!enabled || !imagePath) {
      setLoading(false)
      setError(null)
      setImageSrc(null)
      return
    }

    setLoading(true)
    setError(null)
    setImageSrc(null)

    async function loadImage() {
      try {
        const resolvedImageUrl = await resolveCachedImageUrl(token, imagePath)
        if (cancelled) return

        setImageSrc(resolvedImageUrl)
      } catch (err: unknown) {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Failed to load image')
        setImageSrc(null)
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    loadImage()

    return () => {
      cancelled = true
    }
  }, [token, imagePath, enabled])

  return { imageSrc, loading, error }
}
