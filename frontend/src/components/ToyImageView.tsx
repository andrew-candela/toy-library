// ToyImageView.tsx
import { useState } from 'react'
import { type ToyImageSource, useToyImage } from './useToyImage'

interface ToyImageViewProps {
  token: string
  image: ToyImageSource | null | undefined
  alt: string
  /** Applied to both the image and the placeholder, so the layout never jumps. */
  style: React.CSSProperties
  placeholderBg: string
}

/**
 * A toy image, or a placeholder when there is none or it fails to load.
 *
 * External links are the ones that break — the other site can move or delete
 * the file at any time — so the error fallback matters most for them. They
 * also go out with no referrer: the host has no business knowing which toy
 * listing a viewer was looking at.
 */
export function ToyImageView({ token, image, alt, style, placeholderBg }: ToyImageViewProps) {
  const { imageSrc } = useToyImage(token, image)
  // Remembered per source, so switching to a different image retries cleanly.
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  const imageFailed = imageSrc !== null && imageSrc === failedSrc

  if (!image || !imageSrc || imageFailed) {
    return <div style={{ ...style, background: placeholderBg }} />
  }

  return (
    <img
      src={imageSrc}
      alt={alt}
      onError={() => setFailedSrc(imageSrc)}
      referrerPolicy={image.is_external ? 'no-referrer' : undefined}
      loading={image.is_external ? 'lazy' : undefined}
      style={{ objectFit: 'cover', display: 'block', ...style }}
    />
  )
}
