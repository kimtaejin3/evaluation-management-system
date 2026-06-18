import { getCurrentUser } from '@/lib/session'
import { getSheetData } from '@/lib/evaluate-data'

export async function GET(req: Request) {
  const user = await getCurrentUser()
  if (!user) return new Response('Unauthorized', { status: 401 })
  const { searchParams } = new URL(req.url)
  const sessionId = searchParams.get('sessionId')
  const subjectId = searchParams.get('subjectId')
  if (!sessionId || !subjectId) return new Response('Bad request', { status: 400 })
  const data = await getSheetData(user.id, user.name, sessionId, subjectId)
  if (!data) return new Response('Not found', { status: 404 })
  return Response.json(data)
}
