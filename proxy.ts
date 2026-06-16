import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, type Role } from './lib/auth'

// 역할별 기본 홈
function homeFor(role: Role): string {
  if (role === 'ADMIN') return '/admin/sessions'
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

  if (pathname.startsWith('/admin')) {
    const r = requireRole('ADMIN')
    if (r) return r
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
