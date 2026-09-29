import { createHmac, timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'

const ADMIN_EMAIL = 'paxblockchain1@gmail.com'
const COOKIE_NAME = 'pax_admin_session'

function signature(value: string) {
  return createHmac('sha256', process.env.BETTER_AUTH_SECRET!).update(value).digest('hex')
}

function validSession(value: string | undefined) {
  if (!value) return false
  const [email, expires, digest] = value.split('.')
  if (!email || !expires || !digest || email !== ADMIN_EMAIL || Number(expires) < Date.now()) return false
  const expected = signature(`${email}.${expires}`)
  return digest.length === expected.length && timingSafeEqual(Buffer.from(digest), Buffer.from(expected))
}

export async function GET(request: Request) {
  const cookie = request.headers.get('cookie')?.split('; ').find((item) => item.startsWith(`${COOKIE_NAME}=`))?.slice(COOKIE_NAME.length + 1)
  return NextResponse.json({ authenticated: validSession(cookie), email: validSession(cookie) ? ADMIN_EMAIL : null })
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  if (body.email?.trim().toLowerCase() !== ADMIN_EMAIL || body.password !== process.env.PAX_ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Invalid administrator credentials.' }, { status: 401 })
  }
  const expires = Date.now() + 1000 * 60 * 60 * 8
  const value = `${ADMIN_EMAIL}.${expires}.${signature(`${ADMIN_EMAIL}.${expires}`)}`
  const response = NextResponse.json({ authenticated: true, email: ADMIN_EMAIL })
  response.cookies.set(COOKIE_NAME, value, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 60 * 60 * 8 })
  return response
}

export async function DELETE() {
  const response = NextResponse.json({ authenticated: false })
  response.cookies.set(COOKIE_NAME, '', { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 0 })
  return response
}
