import { NextResponse } from 'next/server'
import { ADMIN_COOKIE_NAME, ADMIN_EMAIL, createAdminSession, getAdminCookie, isValidAdminSession } from '@/lib/admin-session'

export async function GET(request: Request) {
  const cookie = getAdminCookie(request)
  return NextResponse.json({ authenticated: isValidAdminSession(cookie), email: isValidAdminSession(cookie) ? ADMIN_EMAIL : null })
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  if (body.email?.trim().toLowerCase() !== ADMIN_EMAIL || body.password !== process.env.PAX_ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Invalid administrator credentials.' }, { status: 401 })
  }
  const expires = Date.now() + 1000 * 60 * 60 * 8
  const value = createAdminSession(expires)
  const response = NextResponse.json({ authenticated: true, email: ADMIN_EMAIL })
  response.cookies.set(ADMIN_COOKIE_NAME, value, { httpOnly: true, secure: request.url.startsWith('https://'), sameSite: 'lax', path: '/', maxAge: 60 * 60 * 8 })
  return response
}

export async function DELETE() {
  const response = NextResponse.json({ authenticated: false })
  response.cookies.set(ADMIN_COOKIE_NAME, '', { httpOnly: true, secure: false, sameSite: 'lax', path: '/', maxAge: 0 })
  return response
}
