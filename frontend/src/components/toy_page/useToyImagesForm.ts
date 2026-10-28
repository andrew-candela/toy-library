// useToyImagesForm.ts
//
// The image half of the toy create/edit form, shared by the toys page and the
// toy detail page. A toy has up to MAX_TOY_IMAGES images, each an existing one,
// a newly picked file, or a newly pasted link; the first one is the cover.
import { useCallback, useEffect, useRef, useState } from 'react'
import { MAX_TOY_IMAGES, type ToyImage } from '../../api/client'
import { compressImage } from '../../lib/imageCompression'
import type { ToyImageSource } from '../useToyImage'

export interface NewImageFile {
  file: File
  previewUrl: string
}

/**
 * One entry in the form's image list, in display order. `key` is stable for
 * the life of the form, unlike the `file:<n>` / `url:<n>` tokens the API
 * wants, which depend on what else is in the list and are only built on
 * submit.
 */
export type ImageSlot =
  | { kind: 'existing'; key: string; image: ToyImage }
  | ({ kind: 'file'; key: string } & NewImageFile)
  | { kind: 'url'; key: string; url: string }

export function slotSource(slot: ImageSlot): ToyImageSource {
  switch (slot.kind) {
    case 'existing':
      return slot.image
    case 'file':
      // A blob: URL is already local, so it is loaded directly as well.
      return { src: slot.previewUrl, is_external: true }
    case 'url':
      return { src: slot.url, is_external: true }
  }
}

/** Mirrors the backend's validate_external_image_url, so most typos never round-trip. */
export function validateImageUrl(raw: string): string | null {
  const candidate = raw.trim()
  if (!candidate) return 'Paste a link to an image first.'
  if (candidate.length > 2048) return 'Image links must be 2048 characters or fewer.'
  try {
    const url = new URL(candidate)
    if (url.protocol !== 'https:' || !url.hostname) {
      return 'Image links must start with https://'
    }
  } catch {
    return 'Image links must be a full https:// URL.'
  }
  return null
}

function revokePreviews(slots: ImageSlot[]) {
  for (const slot of slots) {
    if (slot.kind === 'file') URL.revokeObjectURL(slot.previewUrl)
  }
}

export interface ToyImagesForm {
  slots: ImageSlot[]
  existingImages: ToyImage[]
  removedImageIds: number[]
  newFiles: NewImageFile[]
  newUrls: string[]
  compressing: boolean
  canAddMore: boolean
  /** Start over from a toy's current images (or none, for a new toy). */
  reset: (images?: ToyImage[]) => void
  addFiles: (files: File[]) => Promise<void>
  /** Returns an error message, or null once the link has been added. */
  addUrl: (raw: string) => string | null
  remove: (key: string) => void
  makeCover: (key: string) => void
  appendToFormData: (payload: FormData) => void
}

export function useToyImagesForm(): ToyImagesForm {
  const [existingImages, setExistingImages] = useState<ToyImage[]>([])
  const [slots, setSlots] = useState<ImageSlot[]>([])
  const [removedImageIds, setRemovedImageIds] = useState<number[]>([])
  const [compressing, setCompressing] = useState(false)
  const nextKey = useRef(0)

  // Kept in a ref as well so the unmount cleanup sees the latest previews
  // rather than the ones from the first render.
  const slotsRef = useRef(slots)
  useEffect(() => {
    slotsRef.current = slots
  }, [slots])
  useEffect(() => () => revokePreviews(slotsRef.current), [])

  const reset = useCallback((images: ToyImage[] = []) => {
    revokePreviews(slotsRef.current)
    const sorted = [...images].sort((a, b) => a.position - b.position)
    const nextSlots: ImageSlot[] = sorted.map((image) => ({
      kind: 'existing',
      key: `id:${image.id}`,
      image,
    }))
    slotsRef.current = nextSlots
    setExistingImages(sorted)
    setSlots(nextSlots)
    setRemovedImageIds([])
  }, [])

  async function addFiles(files: File[]) {
    const room = MAX_TOY_IMAGES - slots.length
    if (files.length === 0 || room <= 0) return
    setCompressing(true)
    try {
      const compressed = await Promise.all(files.slice(0, room).map(compressImage))
      const added: ImageSlot[] = compressed.map((file) => ({
        kind: 'file',
        key: `file-${nextKey.current++}`,
        file,
        previewUrl: URL.createObjectURL(file),
      }))
      setSlots((prev) => {
        // Re-checked here because more could have been added while compressing.
        const fits = added.slice(0, Math.max(0, MAX_TOY_IMAGES - prev.length))
        revokePreviews(added.slice(fits.length))
        return [...prev, ...fits]
      })
    } finally {
      setCompressing(false)
    }
  }

  function addUrl(raw: string): string | null {
    if (slots.length >= MAX_TOY_IMAGES) return `Up to ${MAX_TOY_IMAGES} photos.`
    const error = validateImageUrl(raw)
    if (error) return error
    setSlots((prev) => [...prev, { kind: 'url', key: `url-${nextKey.current++}`, url: raw.trim() }])
    return null
  }

  function remove(key: string) {
    const slot = slots.find((s) => s.key === key)
    if (!slot) return
    if (slot.kind === 'file') URL.revokeObjectURL(slot.previewUrl)
    if (slot.kind === 'existing') {
      setRemovedImageIds((prev) => [...prev, slot.image.id])
    }
    setSlots((prev) => prev.filter((s) => s.key !== key))
  }

  function makeCover(key: string) {
    setSlots((prev) => {
      const slot = prev.find((s) => s.key === key)
      return slot ? [slot, ...prev.filter((s) => s.key !== key)] : prev
    })
  }

  function appendToFormData(payload: FormData) {
    // Tokens index into image_files / image_urls in the order they are
    // appended here, which is also display order, so they always line up.
    const order: string[] = []
    let fileIndex = 0
    let urlIndex = 0
    for (const slot of slots) {
      if (slot.kind === 'existing') {
        order.push(`id:${slot.image.id}`)
      } else if (slot.kind === 'file') {
        payload.append('image_files', slot.file)
        order.push(`file:${fileIndex++}`)
      } else {
        payload.append('image_urls', slot.url)
        order.push(`url:${urlIndex++}`)
      }
    }
    for (const id of removedImageIds) {
      payload.append('remove_image_ids', String(id))
    }
    for (const token of order) {
      payload.append('image_order', token)
    }
  }

  return {
    slots,
    existingImages,
    removedImageIds,
    newFiles: slots.flatMap((s) =>
      s.kind === 'file' ? [{ file: s.file, previewUrl: s.previewUrl }] : [],
    ),
    newUrls: slots.flatMap((s) => (s.kind === 'url' ? [s.url] : [])),
    compressing,
    canAddMore: slots.length < MAX_TOY_IMAGES && !compressing,
    reset,
    addFiles,
    addUrl,
    remove,
    makeCover,
    appendToFormData,
  }
}
