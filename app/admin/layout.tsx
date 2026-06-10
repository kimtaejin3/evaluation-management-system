import Link from 'next/link'
import { logout } from '@/app/login/actions'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between border-b bg-white px-6 py-3">
        <Link href="/admin" className="font-bold">심사·평가 시스템 · 관리자</Link>
        <form action={logout}><button className="text-sm text-gray-500">로그아웃</button></form>
      </header>
      <main className="p-6">{children}</main>
    </div>
  )
}
