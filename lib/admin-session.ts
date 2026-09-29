import { createHmac, timingSafeEqual } from 'node:crypto'

export const ADMIN_EMAIL = 'paxblockchain1@gmail.com'
export const ADMIN_COOKIE_NAME = 'pax_admin_session'

function signature(value: string) {
  return createHmac('sha256', process.env.BETTER_AUTH_SECRET!).update(value).digest('hex')
}

export function createAdminSession(expires: number) {
  const payload = `${ADMIN_EMAIL}.${expires}`
  return `${payload}.${signature(payload)}`
}

export function isValidAdminSession(value: string | undefined) {
  if (!value) return false
  const [email, expires, digest] = value.split('.')
  if (!email || !expires || !digest || email !== ADMIN_EMAIL || !Number.isFinite(Number(expires)) || Number(expires) < Date.now()) return false
  const expected = signature(`${email}.${expires}`)
  return digest.length === expected.length && timingSafeEqual(Buffer.from(digest), Buffer.from(expected))
}

export function getAdminCookie(request: Request) {
  return request.headers.get('cookie')?.split('; ').find((item) => item.startsWith(`${ADMIN_COOKIE_NAME}=`))?.slice(ADMIN_COOKIE_NAME.length + 1)
}
