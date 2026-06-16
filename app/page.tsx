import { redirect } from 'next/navigation'
import { getCurrentToken } from '@/lib/session'

export default async function Home() {
  const payload = await getCurrentToken()
  if (!payload) redirect('/login')
  redirect(payload.role === 'ADMIN' ? '/admin/sessions' : '/evaluate')
}
