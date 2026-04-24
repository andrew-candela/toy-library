const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

export const TOKEN_KEY = 'auth_token'

export interface Item {
  id: number
  title: string
  type: string
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

export interface VerifyEmailResponse {
  message: string
}

export async function login(username: string, password: string): Promise<string> {
  const response = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
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

export async function logout(token: string): Promise<void> {
  await fetch(`${API_URL}/api/auth/logout`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  })
}

export async function fetchItems(token: string): Promise<Item[]> {
  const response = await fetch(`${API_URL}/api/items`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!response.ok) {
    throw new Error(`Failed to fetch items: ${response.statusText}`)
  }
  return response.json() as Promise<Item[]>
}
