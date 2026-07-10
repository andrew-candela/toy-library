// imageCompression.ts
//
// Client-side image compression for toy image uploads. Resizes and re-encodes
// images as JPEG in the browser before they're sent to the backend, so large
// mobile camera photos don't get rejected by nginx's request body size limit.

const MAX_DIMENSION = 1920
const QUALITY_STEPS = [0.8, 0.6, 0.4]
const TARGET_MAX_BYTES = 3.5 * 1024 * 1024

function replaceExtensionWithJpg(filename: string): string {
  const withoutExt = filename.replace(/\.[^./\\]+$/, '')
  return `${withoutExt || 'image'}.jpg`
}

async function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/jpeg', quality)
  })
}

/**
 * Compresses an image file by resizing it to fit within MAX_DIMENSION and
 * re-encoding it as JPEG. Falls back to the original file if compression
 * fails or doesn't actually reduce the file size.
 */
export async function compressImage(file: File): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height))
    const width = Math.round(bitmap.width * scale)
    const height = Math.round(bitmap.height * scale)

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      bitmap.close()
      return file
    }
    ctx.drawImage(bitmap, 0, 0, width, height)
    bitmap.close()

    let bestBlob: Blob | null = null
    for (const quality of QUALITY_STEPS) {
      const blob = await canvasToBlob(canvas, quality)
      if (!blob) continue
      bestBlob = blob
      if (blob.size <= TARGET_MAX_BYTES) break
    }

    if (!bestBlob || bestBlob.size >= file.size) {
      return file
    }

    return new File([bestBlob], replaceExtensionWithJpg(file.name), {
      type: 'image/jpeg',
      lastModified: Date.now(),
    })
  } catch {
    // Decoding/encoding failed (unsupported format, etc.) — upload the original.
    return file
  }
}
