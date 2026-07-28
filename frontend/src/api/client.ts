export const TOKEN_KEY = 'auth_token'

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setStoredToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearStoredToken(): void {
  localStorage.removeItem(TOKEN_KEY)
}

/**
 * Wrapper around fetch that injects the Authorization header and handles 401
 * responses by clearing the stored token and redirecting to /login.
 */
async function authedFetch(token: string, url: string, init: RequestInit = {}): Promise<Response> {
  const response = await fetch(url, {
    ...init,
    headers: {
      ...init.headers,
      Authorization: `Bearer ${token}`,
    },
  })
  if (response.status === 401) {
    clearStoredToken()
    const currentPath = window.location.pathname || '/home'
    const loginPath =
      currentPath !== '/login' ? `/login?next=${encodeURIComponent(currentPath)}` : '/login'
    window.location.replace(loginPath)
    return new Promise<Response>(() => {})
  }
  return response
}

/**
 * Parses an error response body and returns a human-readable message.
 * Handles FastAPI's `{"detail": "..."}` shape as well as pydantic's
 * `{"detail": [{"msg": "...", ...}, ...]}` validation-error shape, falling
 * back to the raw response text (or the provided fallback) otherwise.
 */
async function extractErrorDetail(response: Response, fallback: string): Promise<string> {
  const text = await response.text()
  try {
    const json = JSON.parse(text)
    if (typeof json.detail === 'string' && json.detail) {
      return json.detail
    }
    if (Array.isArray(json.detail)) {
      const messages = json.detail
        .map((item: { msg?: string }) => item?.msg)
        .filter((msg: unknown): msg is string => typeof msg === 'string' && msg.length > 0)
      if (messages.length > 0) {
        return messages.join('; ')
      }
    }
  } catch {
    // not JSON — fall through to raw text
  }
  return text || fallback
}

export type ToyCondition = 'new' | 'like_new' | 'good' | 'fair' | 'poor'

export interface Toy {
  id: number
  title: string
  description?: string
  min_age?: number
  max_age?: number
  image_path?: string
  tags: string[]
  condition?: ToyCondition
  date_added?: string
  neighborhood?: string | null
  owner_username?: string | null
}

export interface ToyCreate {
  title: string
  description?: string
  min_age?: number
  max_age?: number
  image_path?: string
  tags: string[]
  condition?: ToyCondition
  date_added?: string
}

export interface ToyUpdate {
  title?: string
  description?: string
  min_age?: number
  max_age?: number
  image_path?: string
  tags?: string[]
  condition?: ToyCondition
  date_added?: string
}

export interface OwnerInfo {
  username: string
  neighborhood: string | null
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

export interface UserToy {
  id: number
  user_id: number
  toy_id: number
  checked_out_at: string
  user: UserResponse
  toy: Toy
  pending_user: UserResponse | null
}

export interface AuthResponse {
  access_token: string
  token_type: string
}

export interface UserResponse {
  id: number
  username: string
  email: string
  is_email_verified: boolean
}

export interface ProfileResponse {
  id: number
  username: string
  email: string
  is_email_verified: boolean
  neighborhood: string | null
  is_admin?: boolean
}

export interface UpdateUsernameResponse {
  user: UserResponse
  access_token: string
  token_type: string
}

export interface VerifyEmailResponse {
  message: string
}

export async function login(username: string, password: string): Promise<string> {
  const body = new URLSearchParams({ username, password })
  const response = await fetch(`/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })
  if (!response.ok) {
    const detail = await response.text()
    throw new Error(detail || 'Invalid credentials')
  }
  const data = (await response.json()) as AuthResponse
  return data.access_token
}

export async function register(username: string, email: string, password: string): Promise<UserResponse> {
  const response = await fetch(`/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, email, password }),
  })
  if (!response.ok) {
    const detail = await response.text()
    throw new Error(detail || 'Registration failed')
  }
  return response.json() as Promise<UserResponse>
}

export async function verifyEmail(token: string): Promise<VerifyEmailResponse> {
  const response = await fetch(`/api/auth/verify-email?token=${encodeURIComponent(token)}`)
  if (!response.ok) {
    const detail = await response.text()
    throw new Error(detail || 'Verification failed')
  }
  return response.json() as Promise<VerifyEmailResponse>
}

export async function resendVerification(email: string): Promise<VerifyEmailResponse> {
  const response = await fetch(`/api/auth/resend-verification`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  })
  if (!response.ok) {
    const detail = await response.text()
    throw new Error(detail || 'Request failed')
  }
  return response.json() as Promise<VerifyEmailResponse>
}

export async function forgotPassword(email: string): Promise<VerifyEmailResponse> {
  const response = await fetch(`/api/auth/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  })
  if (!response.ok) {
    const detail = await response.text()
    throw new Error(detail || 'Request failed')
  }
  return response.json() as Promise<VerifyEmailResponse>
}

export async function resetPassword(token: string, newPassword: string): Promise<VerifyEmailResponse> {
  const response = await fetch(`/api/auth/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, new_password: newPassword }),
  })
  if (!response.ok) {
    const detail = await response.text()
    throw new Error(detail || 'Reset failed')
  }
  return response.json() as Promise<VerifyEmailResponse>
}

export async function logout(token: string): Promise<void> {
  await authedFetch(token, `/api/auth/logout`, {
    method: 'POST',
  })
}



export async function getProfile(token: string): Promise<ProfileResponse> {
  const response = await authedFetch(token, `/api/profile/me`)
  if (!response.ok) {
    const detail = await response.text()
    throw new Error(detail || 'Failed to fetch profile')
  }
  return response.json() as Promise<ProfileResponse>
}

export async function getUserProfile(token: string, username: string): Promise<ProfileResponse> {
  const response = await authedFetch(token, `/api/profile/${encodeURIComponent(username)}`)
  if (!response.ok) {
    const detail = await response.text()
    throw new Error(detail || 'User not found')
  }
  return response.json() as Promise<ProfileResponse>
}

export async function updateUsername(token: string, username: string): Promise<UpdateUsernameResponse> {
  const response = await authedFetch(token, `/api/profile/username`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username }),
  })
  if (!response.ok) {
    const detail = await response.text()
    throw new Error(detail || 'Failed to update username')
  }
  return response.json() as Promise<UpdateUsernameResponse>
}

export async function updateEmail(token: string, email: string): Promise<{ message: string }> {
  const response = await authedFetch(token, `/api/profile/email`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  })
  if (!response.ok) {
    const detail = await response.text()
    throw new Error(detail || 'Failed to update email')
  }
  return response.json() as Promise<{ message: string }>
}

export async function updateNeighborhood(token: string, neighborhood: string | null): Promise<{ neighborhood: string | null }> {
  const response = await authedFetch(token, `/api/profile/neighborhood`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ neighborhood }),
  })
  if (!response.ok) {
    const detail = await response.text()
    throw new Error(detail || 'Failed to update neighborhood')
  }
  return response.json() as Promise<{ neighborhood: string | null }>
}

export async function fetchToys(
  token: string,
  tags: string[] = [],
  page: number = 1,
  pageSize: number = 20,
  ownedByCurrentUser: boolean = false,
  ownerUsername?: string,
  age?: number,
  search?: string,
  neighborhood?: string,
): Promise<PaginatedResponse<Toy>> {
  const params = new URLSearchParams()
  for (const tag of tags) {
    params.append('tags', tag)
  }
  if (ownedByCurrentUser) {
    params.set('owned_by_current_user', 'true')
  }
  if (ownerUsername) {
    params.set('owner_username', ownerUsername)
  }
  if (neighborhood) {
    params.set('neighborhood', neighborhood)
  }
  if (age !== undefined) {
    params.set('age', String(age))
  }
  if (search) {
    params.set('search', search)
  }
  params.set('page', String(page))
  params.set('page_size', String(pageSize))
  const qs = params.toString()
  const response = await authedFetch(token, `/api/toys/?${qs}`)
  if (!response.ok) {
    throw new Error(await extractErrorDetail(response, `Failed to fetch toys: ${response.statusText}`))
  }
  return response.json() as Promise<PaginatedResponse<Toy>>
}

export async function fetchTagSuggestions(token: string, prefix: string): Promise<string[]> {
  const response = await authedFetch(token, `/api/toys/tags?q=${encodeURIComponent(prefix)}`)
  if (!response.ok) {
    throw new Error('Failed to fetch tag suggestions')
  }
  return response.json() as Promise<string[]>
}

export function appendToyFormFields(formData: FormData, data: ToyCreate | ToyUpdate): void {
  formData.append('title', data.title ?? '')
  if (data.description !== undefined) {
    formData.append('description', data.description)
  }
  if (data.min_age !== undefined) {
    formData.append('min_age', String(data.min_age))
  }
  if (data.max_age !== undefined) {
    formData.append('max_age', String(data.max_age))
  }
  if (data.condition !== undefined) {
    formData.append('condition', data.condition)
  }
  if (data.date_added !== undefined) {
    formData.append('date_added', data.date_added)
  }
  if (data.tags) {
    for (const tag of data.tags) {
      formData.append('tags', tag)
    }
  }
}

export async function createToy(token: string, data: FormData): Promise<Toy> {
  const response = await authedFetch(token, `/api/toys`, {
    method: 'POST',
    body: data,
  })
  if (!response.ok) {
    throw new Error(await extractErrorDetail(response, 'Failed to create toy'))
  }
  return response.json() as Promise<Toy>
}

export async function updateToy(token: string, id: number, data: FormData): Promise<Toy> {
  const response = await authedFetch(token, `/api/toys/${id}`, {
    method: 'PUT',
    body: data,
  })
  if (!response.ok) {
    throw new Error(await extractErrorDetail(response, 'Failed to update toy'))
  }
  return response.json() as Promise<Toy>
}

export async function deleteToy(token: string, id: number): Promise<void> {
  const response = await authedFetch(token, `/api/toys/${id}`, {
    method: 'DELETE',
  })
  if (!response.ok) {
    throw new Error(await extractErrorDetail(response, 'Failed to delete toy'))
  }
}

export async function fetchMyToys(token: string): Promise<UserToy[]> {
  const response = await authedFetch(token, `/api/user-toys`)
  if (!response.ok) {
    throw new Error(`Failed to fetch your toys: ${response.statusText}`)
  }
  return response.json() as Promise<UserToy[]>
}

export async function fetchToy(token: string, id: number): Promise<Toy> {
  const response = await authedFetch(token, `/api/toys/${id}`)
  if (!response.ok) {
    throw new Error(`Failed to fetch toy: ${response.statusText}`)
  }
  return response.json() as Promise<Toy>
}

export async function fetchImage(
  token: string,
  image_path: string
): Promise<Blob> {
  const filename = image_path.split('/').pop() || '';
  const response = await authedFetch(token, `/api/images/${filename}`)
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.statusText}`)
  }
  return response.blob()
}

export async function fetchPendingIncoming(token: string): Promise<UserToy[]> {
  const response = await authedFetch(token, `/api/user-toys/pending-incoming`)
  if (!response.ok) {
    throw new Error(`Failed to fetch pending transfers: ${response.statusText}`)
  }
  return response.json() as Promise<UserToy[]>
}

export async function initiateTransfer(
  token: string,
  toyId: number,
  toUsername: string,
): Promise<UserToy> {
  const response = await authedFetch(token, `/api/user-toys/${toyId}/transfer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to_username: toUsername }),
  })
  if (!response.ok) {
    const detail = await response.text()
    throw new Error(detail || 'Failed to initiate transfer')
  }
  return response.json() as Promise<UserToy>
}

export async function cancelTransfer(token: string, toyId: number): Promise<UserToy> {
  const response = await authedFetch(token, `/api/user-toys/${toyId}/transfer`, {
    method: 'DELETE',
  })
  if (!response.ok) {
    const detail = await response.text()
    throw new Error(detail || 'Failed to cancel transfer')
  }
  return response.json() as Promise<UserToy>
}

export async function acceptTransfer(token: string, toyId: number): Promise<UserToy> {
  const response = await authedFetch(token, `/api/user-toys/${toyId}/transfer/accept`, {
    method: 'POST',
  })
  if (!response.ok) {
    const detail = await response.text()
    throw new Error(detail || 'Failed to accept transfer')
  }
  return response.json() as Promise<UserToy>
}

export interface Interest {
  id: number
  user: UserResponse
  toy_id: number
  created_at: string
}

export interface InterestSummary {
  toy_id: number
  interested_count: number
  viewer_interested: boolean
}

export interface InterestedUserDetail {
  username: string
  created_at: string
}

export interface InterestDetail {
  toy_id: number
  interested_count: number
  can_view_usernames: boolean
  interested_usernames: InterestedUserDetail[]
}

export async function fetchAllInterests(token: string): Promise<InterestSummary[]> {
  const response = await authedFetch(token, `/api/interests`)
  if (!response.ok) {
    throw new Error(`Failed to fetch interests: ${response.statusText}`)
  }
  return response.json() as Promise<InterestSummary[]>
}

export async function fetchInterests(token: string, toyId: number): Promise<InterestDetail> {
  const response = await authedFetch(token, `/api/interests/${toyId}`)
  if (!response.ok) {
    throw new Error(`Failed to fetch interests: ${response.statusText}`)
  }
  return response.json() as Promise<InterestDetail>
}

export async function expressInterest(token: string, toyId: number): Promise<Interest> {
  const response = await authedFetch(token, `/api/interests/${toyId}`, {
    method: 'POST',
  })
  if (!response.ok) {
    const detail = await response.text()
    throw new Error(detail || 'Failed to express interest')
  }
  return response.json() as Promise<Interest>
}

export async function deleteInterest(token: string, toyId: number): Promise<void> {
  const response = await authedFetch(token, `/api/interests/${toyId}`, {
    method: 'DELETE',
  })
  if (!response.ok) {
    const detail = await response.text()
    throw new Error(detail || 'Failed to remove interest')
  }
}

export interface UserListItem {
  id: number
  username: string
  neighborhood: string | null
  toy_count: number
}

export interface UserDetail {
  id: number
  username: string
  neighborhood: string | null
  toy_count: number
}

export interface UserContactEmailResponse {
  message: string
}

export async function fetchUsers(
  token: string,
  neighborhood?: string,
  search?: string,
  page: number = 1,
  pageSize: number = 20,
): Promise<PaginatedResponse<UserListItem>> {
  const params = new URLSearchParams()
  if (neighborhood) {
    params.set('neighborhood', neighborhood)
  }
  if (search) {
    params.set('search', search)
  }
  params.set('page', String(page))
  params.set('page_size', String(pageSize))
  const qs = params.toString()
  const response = await authedFetch(token, `/api/users/?${qs}`)
  if (!response.ok) {
    throw new Error(`Failed to fetch users: ${response.statusText}`)
  }
  return response.json() as Promise<PaginatedResponse<UserListItem>>
}

export async function fetchUserDetail(token: string, username: string): Promise<UserDetail> {
  const response = await authedFetch(token, `/api/users/${encodeURIComponent(username)}`)
  if (!response.ok) {
    const detail = await response.text()
    throw new Error(detail || 'User not found')
  }
  return response.json() as Promise<UserDetail>
}

export async function sendUserContactEmail(
  token: string,
  toUsername: string,
  message: string,
): Promise<UserContactEmailResponse> {
  const response = await authedFetch(token, `/api/user-messages/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to_username: toUsername, message }),
  })

  if (!response.ok) {
    const detail = await response.text()
    throw new Error(detail || 'Failed to send email')
  }

  return response.json() as Promise<UserContactEmailResponse>
}

export interface AllowListResponse {
  emails: string[]
}

export interface AllowListDeleteResponse {
  email: string
}

export async function getAllowlist(token: string): Promise<AllowListResponse> {
  const response = await authedFetch(token, `/api/admin/allowlist`)
  if (!response.ok) {
    throw new Error(await extractErrorDetail(response, 'Failed to fetch allowlist'))
  }
  return response.json() as Promise<AllowListResponse>
}

export async function addAllowlistEmail(token: string, email: string): Promise<AllowListResponse> {
  const response = await authedFetch(token, `/api/admin/allowlist/${encodeURIComponent(email)}`, {
    method: 'POST',
  })
  if (!response.ok) {
    throw new Error(await extractErrorDetail(response, 'Failed to add email to allowlist'))
  }
  return response.json() as Promise<AllowListResponse>
}

export async function removeAllowlistEmail(token: string, email: string): Promise<AllowListDeleteResponse> {
  const response = await authedFetch(token, `/api/admin/allowlist/${encodeURIComponent(email)}`, {
    method: 'DELETE',
  })
  if (!response.ok) {
    throw new Error(await extractErrorDetail(response, 'Failed to remove email from allowlist'))
  }
  return response.json() as Promise<AllowListDeleteResponse>
}

export async function triggerToyEmbedding(token: string, toyId: number): Promise<void> {
  const response = await authedFetch(token, `/api/admin/trigger_embedding?toy_id=${toyId}`, {
    method: 'POST',
  })
  if (!response.ok) {
    throw new Error(await extractErrorDetail(response, 'Failed to trigger embedding'))
  }
}
