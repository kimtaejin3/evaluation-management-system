import { getCurrentUser } from '@/lib/session'
import { getHomeData } from '@/lib/evaluate-data'

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return new Response('Unauthorized', { status: 401 })
  const data = await getHomeData(user.id)
  return Response.json({ evaluatorName: user.name, sessions: data })
}
