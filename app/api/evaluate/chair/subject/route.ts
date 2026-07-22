import { getCurrentUser } from '@/lib/session'
import { getChairSubjectData } from '@/lib/evaluate-data'

export async function GET(req: Request) {
  const user = await getCurrentUser()
  if (!user) return new Response('Unauthorized', { status: 401 })
  const { searchParams } = new URL(req.url)
  const sessionId = searchParams.get('sessionId')
  const subjectId = searchParams.get('subjectId')
  if (!sessionId || !subjectId) return new Response('Bad request', { status: 400 })
  const data = await getChairSubjectData(user.id, sessionId, subjectId)
  if (!data) return new Response('Forbidden', { status: 403 })
  return Response.json(data)
}
