import { cookies } from 'next/headers'
import type { NextRequest } from 'next/server'
import crypto from 'crypto'

/** Generate a hex token from ADMIN_ID + ADMIN_PASSWORD (no special chars) */
export function getExpectedToken(): string | null {
  const id = process.env.ADMIN_ID || 'admin'
  const pass = process.env.ADMIN_PASSWORD
  if (!pass) return null
  return crypto.createHash('sha256').update(`${id}:${pass}`).digest('hex')
}

/** For use in API Route Handlers (NextRequest) */
export function isAuthedRequest(req: NextRequest): boolean {
  const token = getExpectedToken()
  if (!token) return false
  return req.cookies.get('admin_auth')?.value === token
}

/** For use in Server Components (next/headers) */
export function isAuthedServer(): boolean {
  const token = getExpectedToken()
  if (!token) return false
  return cookies().get('admin_auth')?.value === token
}
