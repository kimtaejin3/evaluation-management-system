import { getCurrentToken } from '@/lib/session'
import { getProgressVersion } from '@/lib/progress'

// SSE 스트림은 항상 동적 + Node 런타임(Vercel Fluid Compute·사내 Node 서버 동일)
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
// 함수 최대 실행시간(플랫폼 한도 내). 스트림은 아래 MAX_MS로 스스로 종료하고 클라이언트가 자동 재연결.
export const maxDuration = 60

const POLL_MS = 3000 // DB 변경 확인 주기
const MAX_MS = 50_000 // 이 시간 후 스트림 종료 → EventSource 자동 재연결(플랫폼 타임아웃 회피)

function wait(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(new Error('aborted'))
    const t = setTimeout(resolve, ms)
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(t)
        reject(new Error('aborted'))
      },
      { once: true },
    )
  })
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const token = await getCurrentToken()
  if (!token || token.role !== 'ADMIN') return new Response('Unauthorized', { status: 401 })

  const { id } = await params
  const encoder = new TextEncoder()
  const signal = req.signal

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const enqueue = (s: string) => {
        try {
          controller.enqueue(encoder.encode(s))
        } catch {
          /* 컨트롤러가 이미 닫힘 */
        }
      }
      const sendEvent = (event: string, data: string) => enqueue(`event: ${event}\ndata: ${data}\n\n`)
      const sendComment = () => enqueue(`: ping\n\n`) // 프록시 idle 연결 유지용 주석

      // 재연결 간격 권장값(ms)
      enqueue(`retry: 3000\n\n`)

      let last: string
      try {
        last = await getProgressVersion(id)
      } catch {
        last = ''
      }
      sendEvent('connected', last)

      const started = Date.now()
      try {
        while (!signal.aborted && Date.now() - started < MAX_MS) {
          await wait(POLL_MS, signal)
          let v: string
          try {
            v = await getProgressVersion(id)
          } catch {
            continue
          }
          if (v !== last) {
            last = v
            sendEvent('update', v)
          } else {
            sendComment()
          }
        }
      } catch {
        /* abort */
      } finally {
        try {
          controller.close()
        } catch {
          /* already closed */
        }
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no', // nginx 등 리버스 프록시 버퍼링 방지(사내 서버 대비)
    },
  })
}
