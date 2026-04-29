import { Navigate, Outlet, Link, useLocation } from 'react-router-dom'
import { useAuth } from '../../lib/auth'

const ICON_CALENDAR = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <line x1="3" y1="10" x2="21" y2="10" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
  </svg>
)
const ICON_PLUS = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="16" />
    <line x1="8" y1="12" x2="16" y2="12" />
  </svg>
)
const ICON_USERS = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
)
const ICON_CLIPBOARD = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
    <rect x="8" y="2" width="8" height="4" rx="1" />
  </svg>
)
const ICON_LOGOUT = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
)

const NAV_ITEMS = [
  { path: '/admin/i-dag', label: 'I dag', icon: ICON_CALENDAR },
  { path: '/admin/opret-booking', label: 'Opret booking', icon: ICON_PLUS },
  { path: '/admin/kunder', label: 'Kunder', icon: ICON_USERS },
  { path: '/admin/noter', label: 'Noter', icon: ICON_CLIPBOARD },
]

export function AdminLayout() {
  const { user, role, barberName, loading, signOut } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F6F6F3]">
        <p className="text-sm text-[#8A8A8A]">Henter…</p>
      </div>
    )
  }

  if (!user || !role) {
    return <Navigate to="/admin/login" replace />
  }

  const isActive = (path: string) =>
    location.pathname === path || (path === '/admin/i-dag' && location.pathname === '/admin')

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-[#F6F6F3]">
      {/* Sidebar — desktop vertical / mobile top bar */}
      <aside className="bg-[#111113] text-[#FAFAF8] md:w-60 md:min-h-screen flex-shrink-0 flex md:flex-col">
        {/* Logo + user — desktop only at top */}
        <div className="hidden md:block px-4 py-5 border-b border-white/[0.06]">
          <Link to="/" className="block mb-3">
            <img src="/logo.png" alt="Design Klip" className="h-9 w-auto opacity-90" />
          </Link>
          <p className="text-[13px] text-[#FAFAF8]">
            {barberName ?? 'Admin'}
            {role === 'super_admin' && (
              <span className="text-[#8A8A8A] font-normal"> (ejer)</span>
            )}
          </p>
        </div>

        {/* Mobile compact header */}
        <div className="md:hidden flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
          <Link to="/" className="flex items-center gap-2">
            <img src="/logo.png" alt="Design Klip" className="h-7 w-auto opacity-90" />
          </Link>
          <p className="text-[12px] text-[#8A8A8A]">{barberName ?? 'Admin'}</p>
        </div>

        {/* Nav */}
        <nav className="flex md:flex-col gap-1 p-2 md:p-3 overflow-x-auto md:overflow-visible">
          {NAV_ITEMS.map((item) => {
            const active = isActive(item.path)
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13.5px] whitespace-nowrap transition-colors relative ${
                  active
                    ? 'bg-[rgba(176,138,62,0.12)] text-[#B08A3E] font-medium'
                    : 'text-[#FAFAF8]/85 hover:bg-white/[0.04] hover:text-[#FAFAF8]'
                }`}
                style={{ fontWeight: active ? 500 : 450 }}
              >
                {active && (
                  <span className="hidden md:block absolute left-0 top-1.5 bottom-1.5 w-[2px] bg-[#B08A3E] rounded-r" />
                )}
                <span className="flex-shrink-0">{item.icon}</span>
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* Spacer + log-out — desktop only */}
        <div className="hidden md:block mt-auto p-3 border-t border-white/[0.06]">
          <button
            onClick={signOut}
            className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-[13px] text-[#8A8A8A] hover:text-[#FAFAF8] hover:bg-white/[0.04] transition-colors"
          >
            <span className="flex-shrink-0">{ICON_LOGOUT}</span>
            Log ud
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 min-h-screen">
        <div className="p-4 md:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
