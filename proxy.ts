import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from './lib/auth'

export async function proxy(req: NextRequest) {
  const token = req.cookies.get('auth_token')?.value
  const payload = token ? await verifyToken(token) : null
  const { pathname } = req.nextUrl

  if (pathname.startsWith('/admin')) {
    if (!payload) return NextResponse.redirect(new URL('/login', req.url))
    if (payload.role !== 'ADMIN') return NextResponse.redirect(new URL('/evaluate', req.url))
  }
  if (pathname.startsWith('/evaluate')) {
    if (!payload) return NextResponse.redirect(new URL('/login', req.url))
    if (payload.role !== 'EVALUATOR') return NextResponse.redirect(new URL('/admin', req.url))
  }
  if (pathname.startsWith('/viewer')) {
    if (!payload) return NextResponse.redirect(new URL('/login', req.url))
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*', '/evaluate/:path*', '/viewer/:path*'],
}
