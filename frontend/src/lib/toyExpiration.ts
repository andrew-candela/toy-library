import type { Toy } from '../api/client'

/**
 * Mirrors EXPIRY_WARNING_WINDOW in backend/app/lib/toy_expiration.py. Only
 * affects what the owner is nudged about — an expiring toy is still fully
 * listed, so this drifting from the backend costs a misleading banner rather
 * than a wrong visibility decision.
 */
export const EXPIRY_WARNING_DAYS = 7

const MS_PER_DAY = 24 * 60 * 60 * 1000

export type ExpiryState =
  { kind: 'ok' } | { kind: 'expiring'; daysLeft: number } | { kind: 'expired' }

/**
 * What to tell the owner about this listing's expiry.
 *
 * `is_expired` is only ever true on the viewer's own toys — the API filters
 * everyone else's expired listings out of the response entirely — so callers
 * still gate the resulting UI on ownership to decide whether to offer Refresh,
 * not to decide whether the state is trustworthy.
 */
export function expiryState(toy: Toy): ExpiryState {
  if (toy.is_expired) return { kind: 'expired' }
  // Null means no deadline to warn about: somebody is interested, which stops
  // the clock for as long as they stay interested.
  if (!toy.expires_at) return { kind: 'ok' }

  const msLeft = new Date(toy.expires_at).getTime() - Date.now()
  if (Number.isNaN(msLeft) || msLeft > EXPIRY_WARNING_DAYS * MS_PER_DAY) {
    return { kind: 'ok' }
  }
  // Round up so the last full day reads "1 day left" rather than "0 days left".
  return { kind: 'expiring', daysLeft: Math.max(1, Math.ceil(msLeft / MS_PER_DAY)) }
}

/** Short label for a badge in a dense list. */
export function expiryBadgeLabel(state: ExpiryState): string | null {
  if (state.kind === 'expired') return 'Expired'
  if (state.kind === 'expiring') {
    return `Expires in ${state.daysLeft} ${state.daysLeft === 1 ? 'day' : 'days'}`
  }
  return null
}

/** Full sentence for the toy detail page, where there is room to explain. */
export function expiryMessage(state: ExpiryState): string | null {
  if (state.kind === 'expired') {
    return 'This toy has expired and is hidden from everyone else. Refresh it to list it again.'
  }
  if (state.kind === 'expiring') {
    const days = `${state.daysLeft} ${state.daysLeft === 1 ? 'day' : 'days'}`
    return `This toy expires in ${days} and will then be hidden from everyone else. Refresh it to keep it listed.`
  }
  return null
}
