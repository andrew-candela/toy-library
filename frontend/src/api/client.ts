const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

export const TOKEN_KEY = 'auth_token'

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
    sessionStorage.removeItem(TOKEN_KEY)
    window.location.replace('/login')
    return new Promise<Response>(() => {})
  }
  return response
}

export type ItemCondition = 'new' | 'like_new' | 'good' | 'fair' | 'poor'

export interface Toy {
  id: number
  title: string
  description?: string
  age_range?: string
  image_url?: string
  tags: string[]
}

export interface ToyCreate {
  title: string
  description?: string
  age_range?: string
  image_url?: string
  tags: string[]
}

export interface ToyUpdate {
  title?: string
  description?: string
  age_range?: string
  image_url?: string
  tags?: string[]
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

export interface Item {
  id: number
  toy_id: number
  condition: ItemCondition
  date_added: string
  toy: Toy
  owner?: OwnerInfo | null
}

export interface UserItem {
  id: number
  user_id: number
  item_id: number
  checked_out_at: string
  user: UserResponse
  item: Item
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
  const response = await fetch(`${API_URL}/api/auth/login`, {
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
  const response = await fetch(`${API_URL}/api/auth/register`, {
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
  const response = await fetch(`${API_URL}/api/auth/verify-email?token=${encodeURIComponent(token)}`)
  if (!response.ok) {
    const detail = await response.text()
    throw new Error(detail || 'Verification failed')
  }
  return response.json() as Promise<VerifyEmailResponse>
}

export async function resendVerification(email: string): Promise<VerifyEmailResponse> {
  const response = await fetch(`${API_URL}/api/auth/resend-verification`, {
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
  const response = await fetch(`${API_URL}/api/auth/forgot-password`, {
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
  const response = await fetch(`${API_URL}/api/auth/reset-password`, {
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
  await authedFetch(token, `${API_URL}/api/auth/logout`, {
    method: 'POST',
  })
}

export interface FetchItemsParams {
  page?: number
  pageSize?: number
  neighborhood?: string
  toyTitle?: string
  tags?: string[]
  myItemsOnly?: boolean
  toyId?: number
  ownerUsername?: string
}

export async function fetchItems(token: string, params?: FetchItemsParams): Promise<PaginatedResponse<Item>> {
  const p = new URLSearchParams()
  if (params?.page) p.set('page', String(params.page))
  if (params?.pageSize) p.set('page_size', String(params.pageSize))
  if (params?.neighborhood) p.set('neighborhood', params.neighborhood)
  if (params?.toyTitle) p.set('toy_title', params.toyTitle)
  if (params?.tags) for (const tag of params.tags) p.append('tags', tag)
  if (params?.myItemsOnly) p.set('my_items_only', 'true')
  if (params?.toyId != null) p.set('toy_id', String(params.toyId))
  if (params?.ownerUsername) p.set('owner_username', params.ownerUsername)
  const qs = p.toString()
  const response = await authedFetch(token, `${API_URL}/api/items${qs ? `?${qs}` : ''}`)
  if (!response.ok) {
    throw new Error(`Failed to fetch items: ${response.statusText}`)
  }
  return response.json() as Promise<PaginatedResponse<Item>>
}

export async function createItem(
  token: string,
  data: { toy_id: number; condition: ItemCondition },
): Promise<Item> {
  const response = await authedFetch(token, `${API_URL}/api/items`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!response.ok) {
    const detail = await response.text()
    throw new Error(detail || 'Failed to create item')
  }
  return response.json() as Promise<Item>
}

export async function updateItem(
  token: string,
  id: number,
  data: { toy_id?: number; condition?: ItemCondition },
): Promise<Item> {
  const response = await authedFetch(token, `${API_URL}/api/items/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!response.ok) {
    const detail = await response.text()
    throw new Error(detail || 'Failed to update item')
  }
  return response.json() as Promise<Item>
}

export async function deleteItem(token: string, id: number): Promise<void> {
  const response = await authedFetch(token, `${API_URL}/api/items/${id}`, {
    method: 'DELETE',
  })
  if (!response.ok) {
    const detail = await response.text()
    throw new Error(detail || 'Failed to delete item')
  }
}

export async function getProfile(token: string): Promise<ProfileResponse> {
  const response = await authedFetch(token, `${API_URL}/api/profile/me`)
  if (!response.ok) {
    const detail = await response.text()
    throw new Error(detail || 'Failed to fetch profile')
  }
  return response.json() as Promise<ProfileResponse>
}

export async function getUserProfile(token: string, username: string): Promise<ProfileResponse> {
  const response = await authedFetch(token, `${API_URL}/api/profile/${encodeURIComponent(username)}`)
  if (!response.ok) {
    const detail = await response.text()
    throw new Error(detail || 'User not found')
  }
  return response.json() as Promise<ProfileResponse>
}

export async function updateUsername(token: string, username: string): Promise<UpdateUsernameResponse> {
  const response = await authedFetch(token, `${API_URL}/api/profile/username`, {
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
  const response = await authedFetch(token, `${API_URL}/api/profile/email`, {
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
  const response = await authedFetch(token, `${API_URL}/api/profile/neighborhood`, {
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
): Promise<PaginatedResponse<Toy>> {
  const params = new URLSearchParams()
  for (const tag of tags) {
    params.append('tags', tag)
  }
  params.set('page', String(page))
  params.set('page_size', String(pageSize))
  const qs = params.toString()
  const response = await authedFetch(token, `${API_URL}/api/toys/?${qs}`)
  if (!response.ok) {
    throw new Error(`Failed to fetch toys: ${response.statusText}`)
  }
  return response.json() as Promise<PaginatedResponse<Toy>>
}

export async function fetchTagSuggestions(token: string, prefix: string): Promise<string[]> {
  const response = await authedFetch(token, `${API_URL}/api/toys/tags?q=${encodeURIComponent(prefix)}`)
  if (!response.ok) {
    throw new Error('Failed to fetch tag suggestions')
  }
  return response.json() as Promise<string[]>
}

export async function createToy(token: string, data: ToyCreate): Promise<Toy> {
  const response = await authedFetch(token, `${API_URL}/api/toys`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!response.ok) {
    const detail = await response.text()
    throw new Error(detail || 'Failed to create toy')
  }
  return response.json() as Promise<Toy>
}

export async function updateToy(token: string, id: number, data: ToyUpdate): Promise<Toy> {
  const response = await authedFetch(token, `${API_URL}/api/toys/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!response.ok) {
    const detail = await response.text()
    throw new Error(detail || 'Failed to update toy')
  }
  return response.json() as Promise<Toy>
}

export async function deleteToy(token: string, id: number): Promise<void> {
  const response = await authedFetch(token, `${API_URL}/api/toys/${id}`, {
    method: 'DELETE',
  })
  if (!response.ok) {
    const text = await response.text()
    let detail = text
    try {
      const json = JSON.parse(text)
      if (json.detail) detail = json.detail
    } catch {
      // not JSON — use raw text
    }
    throw new Error(detail || 'Failed to delete toy')
  }
}

export async function fetchMyItems(token: string): Promise<UserItem[]> {
  const response = await authedFetch(token, `${API_URL}/api/user-items`)
  if (!response.ok) {
    throw new Error(`Failed to fetch your items: ${response.statusText}`)
  }
  return response.json() as Promise<UserItem[]>
}

export async function fetchToy(token: string, id: number): Promise<Toy> {
  const response = await authedFetch(token, `${API_URL}/api/toys/${id}`)
  if (!response.ok) {
    throw new Error(`Failed to fetch toy: ${response.statusText}`)
  }
  return response.json() as Promise<Toy>
}

export async function fetchPendingIncoming(token: string): Promise<UserItem[]> {
  const response = await authedFetch(token, `${API_URL}/api/user-items/pending-incoming`)
  if (!response.ok) {
    throw new Error(`Failed to fetch pending transfers: ${response.statusText}`)
  }
  return response.json() as Promise<UserItem[]>
}

export async function initiateTransfer(
  token: string,
  itemId: number,
  toUsername: string,
): Promise<UserItem> {
  const response = await authedFetch(token, `${API_URL}/api/user-items/${itemId}/transfer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to_username: toUsername }),
  })
  if (!response.ok) {
    const detail = await response.text()
    throw new Error(detail || 'Failed to initiate transfer')
  }
  return response.json() as Promise<UserItem>
}

export async function cancelTransfer(token: string, itemId: number): Promise<UserItem> {
  const response = await authedFetch(token, `${API_URL}/api/user-items/${itemId}/transfer`, {
    method: 'DELETE',
  })
  if (!response.ok) {
    const detail = await response.text()
    throw new Error(detail || 'Failed to cancel transfer')
  }
  return response.json() as Promise<UserItem>
}

export async function acceptTransfer(token: string, itemId: number): Promise<UserItem> {
  const response = await authedFetch(token, `${API_URL}/api/user-items/${itemId}/transfer/accept`, {
    method: 'POST',
  })
  if (!response.ok) {
    const detail = await response.text()
    throw new Error(detail || 'Failed to accept transfer')
  }
  return response.json() as Promise<UserItem>
}

export interface Interest {
  id: number
  user: UserResponse
  item_id: number
  created_at: string
}

export async function fetchAllInterests(token: string): Promise<Interest[]> {
  const response = await authedFetch(token, `${API_URL}/api/items/interests`)
  if (!response.ok) {
    throw new Error(`Failed to fetch interests: ${response.statusText}`)
  }
  return response.json() as Promise<Interest[]>
}

export async function fetchInterests(token: string, itemId: number): Promise<Interest[]> {
  const response = await authedFetch(token, `${API_URL}/api/items/${itemId}/interests`)
  if (!response.ok) {
    throw new Error(`Failed to fetch interests: ${response.statusText}`)
  }
  return response.json() as Promise<Interest[]>
}

export async function expressInterest(token: string, itemId: number): Promise<Interest> {
  const response = await authedFetch(token, `${API_URL}/api/items/${itemId}/interests`, {
    method: 'POST',
  })
  if (!response.ok) {
    const detail = await response.text()
    throw new Error(detail || 'Failed to express interest')
  }
  return response.json() as Promise<Interest>
}

export async function deleteInterest(token: string, itemId: number): Promise<void> {
  const response = await authedFetch(token, `${API_URL}/api/items/${itemId}/interests`, {
    method: 'DELETE',
  })
  if (!response.ok) {
    const detail = await response.text()
    throw new Error(detail || 'Failed to remove interest')
  }
}
