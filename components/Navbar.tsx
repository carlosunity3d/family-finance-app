'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function Navbar() {
  const pathname = usePathname()
  const router = useRouter()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const linkClass = (href: string) =>
    `text-sm font-medium px-3 py-1 rounded-lg transition ${
      pathname === href
        ? 'bg-blue-100 text-blue-700'
        : 'text-gray-600 hover:text-gray-900'
    }`

  return (
    <nav className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
      <span className="font-bold text-gray-800 text-lg">Family Finance</span>
      <div className="flex items-center gap-2">
        <Link href="/" className={linkClass('/')}>Dashboard</Link>
        <Link href="/yearly" className={linkClass('/yearly')}>Yearly Summary</Link>
        <button
          onClick={handleLogout}
          className="text-sm font-medium text-red-500 hover:text-red-700 ml-4"
        >
          Logout
        </button>
      </div>
    </nav>
  )
}
