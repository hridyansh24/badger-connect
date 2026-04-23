const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000'

type Json = Record<string, unknown>

const post = async <T>(path: string, body: Json): Promise<T> => {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = (await res.json().catch(() => ({}))) as T & { error?: string }
  if (!res.ok) {
    throw new Error(data.error || 'Request failed. Try again.')
  }
  return data
}

export type RequestCodeResponse = { ok: true; expiresInSec: number }
export type VerifyCodeResponse = {
  ok: true
  token: string
  user: { email: string; name: string; interests: string[] }
}

export const requestCode = (payload: { name: string; email: string }) =>
  post<RequestCodeResponse>('/auth/request-code', payload)

export const verifyCode = (payload: {
  name: string
  email: string
  code: string
  interests: string[]
}) => post<VerifyCodeResponse>('/auth/verify-code', payload)
