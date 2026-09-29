import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import AdminDashboard from '@/components/admin-dashboard'
import { isValidAdminSession } from '@/lib/admin-session'

export default async function AdminPage() {
  const cookie = (await headers()).get('cookie')?.split('; ').find((item) => item.startsWith('pax_admin_session='))?.slice('pax_admin_session='.length)
  if (!isValidAdminSession(cookie)) redirect('/admin-login')
  return <AdminDashboard />
}
