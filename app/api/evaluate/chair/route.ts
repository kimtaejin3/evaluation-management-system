import { getCurrentUser } from '@/lib/session'
import { getChairData } from '@/lib/evaluate-data'

export async function GET(req: Request) {
  const user = await getCurrentUser()
  if (!user) return new Response('Unauthorized', { status: 401 })
  const { searchParams } = new URL(req.url)
  const sessionId = searchParams.get('sessionId')
  if (!sessionId) return new Response('Bad request', { status: 400 })
  const data = await getChairData(user.id, sessionId)
  if (!data) return new Response('Forbidden', { status: 403 })
  return Response.json(data)
}
