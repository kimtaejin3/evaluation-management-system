import { redirect } from 'next/navigation'
import { getCurrentToken } from '@/lib/session'

export default async function Home() {
  const payload = await getCurrentToken()
  if (!payload) redirect('/login')
  if (payload.role === 'MASTER') redirect('/admin/projects')
  if (payload.role === 'SECRETARY') redirect('/admin/sessions')
  redirect('/evaluate')
}
