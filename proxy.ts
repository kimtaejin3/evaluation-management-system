import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, type Role } from './lib/auth'

// 역할별 기본 홈
function homeFor(role: Role): string {
  if (role === 'MASTER') return '/admin/projects'
  if (role === 'SECRETARY') return '/admin/sessions'
  return '/evaluate'
}

export async function proxy(req: NextRequest) {
  const token = req.cookies.get('auth_token')?.value
  const payload = token ? await verifyToken(token) : null
  const { pathname } = req.nextUrl

  const requireRole = (role: Role) => {
    if (!payload) return NextResponse.redirect(new URL('/login', req.url))
    if (payload.role !== role) return NextResponse.redirect(new URL(homeFor(payload.role), req.url))
    return null
  }

  // 관리영역: 마스터·간사 허용, 평가위원은 차단(세부 분과 소유 검증은 서버 레이아웃/액션에서)
  if (pathname.startsWith('/admin')) {
    if (!payload) return NextResponse.redirect(new URL('/login', req.url))
    if (payload.role === 'EVALUATOR') return NextResponse.redirect(new URL(homeFor(payload.role), req.url))
  }
  if (pathname.startsWith('/evaluate')) {
    const r = requireRole('EVALUATOR')
    if (r) return r
  }
  if (pathname.startsWith('/viewer')) {
    if (!payload) return NextResponse.redirect(new URL('/login', req.url))
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*', '/evaluate/:path*', '/viewer/:path*'],
}
