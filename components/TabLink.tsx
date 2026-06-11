'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function TabLink({
  href,
  exact = false,
  children,
}: {
  href: string
  exact?: boolean
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const active = exact ? pathname === href : pathname === href || pathname.startsWith(href + '/')
  return (
    <Link
      href={href}
      className={`-mb-px border-b-2 px-4 py-2.5 text-sm transition ${
        active
          ? 'border-indigo-600 text-indigo-600 font-semibold'
          : 'border-transparent text-slate-500 hover:text-slate-800'
      }`}
    >
      {children}
    </Link>
  )
}
