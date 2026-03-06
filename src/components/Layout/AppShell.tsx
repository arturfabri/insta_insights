import { useState, useMemo } from 'react'
import { Outlet, Link } from 'react-router-dom'
import Navbar from './Navbar'
import Sidebar from './Sidebar'
import { useInstagramAccount } from '@/hooks/useInstagramAccount'

export default function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { account } = useInstagramAccount()

  // Show global warning when token expires within 7 days
  const tokenExpiringSoon = useMemo(() => {
    if (!account?.token_expires_at) return false
    const sevenDaysFromNow = new Date()
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7)
    return new Date(account.token_expires_at) < sevenDaysFromNow
  }, [account])

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* ── Mobile sidebar overlay ───────────────────────────────────── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/40 lg:hidden"
          aria-hidden="true"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar ─────────────────────────────────────────────────── */}
      {/* On desktop: always visible. On mobile: slide-in drawer. */}
      <div
        className={`fixed inset-y-0 left-0 z-30 transition-transform duration-200 lg:static lg:translate-x-0 lg:z-auto ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <Sidebar onClose={() => setSidebarOpen(false)} />
      </div>

      {/* ── Main content ────────────────────────────────────────────── */}
      <div className="flex flex-col flex-1 min-w-0">
        <Navbar onMenuClick={() => setSidebarOpen(true)} />

        {/* Token expiry warning — shown on all pages when < 7 days left */}
        {tokenExpiringSoon && (
          <div
            role="alert"
            className="flex items-center gap-2 px-6 py-2 bg-amber-50 border-b border-amber-200 text-sm text-amber-700"
          >
            <span aria-hidden="true">⚠️</span>
            <span>
              Your Meta Business connection expires soon.{' '}
              <Link to="/connect" className="font-medium underline underline-offset-2 hover:no-underline">
                Reconnect now
              </Link>{' '}
              to keep your data syncing with full insight coverage.
            </span>
          </div>
        )}

        <main className="flex-1 p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
