import { useState } from 'react'
import { Navigate, Outlet, Link, useLocation } from 'react-router-dom'
import { useAuth } from '../../lib/auth'

const ICON_SCHEDULE = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
)
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
const ICON_STAFF = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 11h-6" />
    <path d="M19 8v6" />
  </svg>
)
const ICON_NOTES = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
    <rect x="8" y="2" width="8" height="4" rx="1" />
  </svg>
)
const ICON_SCISSORS = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="6" cy="6" r="3" />
    <circle cx="6" cy="18" r="3" />
    <line x1="20" y1="4" x2="8.12" y2="15.88" />
    <line x1="14.47" y1="14.48" x2="20" y2="20" />
    <line x1="8.12" y1="8.12" x2="12" y2="12" />
  </svg>
)
const ICON_CHART = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
    <path d="M5 9.2h3V19H5zM10.6 5h2.8v14h-2.8zm5.6 8H19v6h-2.8z" />
  </svg>
)
const ICON_LOGOUT = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
)
const ICON_MENU = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="3" y1="6" x2="21" y2="6" />
    <line x1="3" y1="12" x2="21" y2="12" />
    <line x1="3" y1="18" x2="21" y2="18" />
  </svg>
)
const ICON_X = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
)

const NAV_ITEMS = [
  { path: '/admin/i-dag', label: 'I dag', icon: ICON_SCHEDULE },
  { path: '/admin/kalender', label: 'Kalender', icon: ICON_CALENDAR },
  { path: '/admin/overblik', label: 'Overblik', icon: ICON_CHART },
  { path: '/admin/opret-booking', label: 'Opret booking', icon: ICON_PLUS },
  { path: '/admin/kunder', label: 'Kunder', icon: ICON_USERS },
  { path: '/admin/medarbejdere', label: 'Medarbejdere', icon: ICON_STAFF },
  { path: '/admin/ydelser', label: 'Ydelser', icon: ICON_SCISSORS },
  { path: '/admin/noter', label: 'Noter', icon: ICON_NOTES },
]

function getPageTitle(pathname: string): string {
  if (pathname === '/admin' || pathname === '/admin/i-dag') return 'I dag'
  if (pathname.startsWith('/admin/kalender')) return 'Kalender'
  if (pathname.startsWith('/admin/overblik')) return 'Overblik'
  if (pathname.startsWith('/admin/opret-booking')) return 'Opret booking'
  if (pathname.startsWith('/admin/kunder/')) return 'Kunde'
  if (pathname.startsWith('/admin/kunder')) return 'Kunder'
  if (pathname.startsWith('/admin/medarbejdere')) return 'Medarbejdere'
  if (pathname.startsWith('/admin/ydelser')) return 'Ydelser'
  if (pathname.startsWith('/admin/booking/')) return 'Booking'
  if (pathname.startsWith('/admin/noter')) return 'Salonnoter'
  return 'Admin'
}

export function AdminLayout() {
  const { user, role, barberName, loading, signOut } = useAuth()
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F9FAFB]">
        <p className="text-sm text-gray-500">Henter…</p>
      </div>
    )
  }

  if (!user || !role) {
    return <Navigate to="/admin/login" replace />
  }

  const isActive = (path: string) =>
    location.pathname === path || (path === '/admin/i-dag' && location.pathname === '/admin')

  const pageTitle = getPageTitle(location.pathname)

  const navLink = (item: (typeof NAV_ITEMS)[number], onClick?: () => void) => {
    const active = isActive(item.path)
    return (
      <Link
        key={item.path}
        to={item.path}
        onClick={onClick}
        className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-[13px] transition-colors ${
          active
            ? 'bg-[#B08A3E]/20 text-[#D4A84B] font-medium'
            : 'text-white/60 hover:bg-white/5 hover:text-white/90'
        }`}
      >
        <span className="flex-shrink-0">{item.icon}</span>
        {item.label}
      </Link>
    )
  }

  return (
    <div className="min-h-screen md:h-screen md:overflow-hidden flex flex-col md:flex-row bg-[#F9FAFB]">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:flex-col bg-[#1A1A1A] text-white w-[220px] md:h-screen flex-shrink-0">
        <div className="px-4 py-5 border-b border-white/[0.08] text-center">
          <img src="/logo.png" alt="Design Klip" className="w-16 h-16 mx-auto mb-3" />
          <p className="font-serif text-[17px] tracking-wide">Design Klip</p>
          <p className="text-[12px] text-white/60 mt-1">
            {barberName ?? 'Admin'}
            {role === 'super_admin' && ' · Ejer'}
          </p>
        </div>

        <nav className="flex-1 flex flex-col gap-1 p-3 overflow-y-auto">
          {NAV_ITEMS.map((item) => navLink(item))}
        </nav>

        <div className="p-3 border-t border-white/[0.08]">
          <button
            onClick={signOut}
            className="flex items-center gap-2.5 w-full px-3 py-2 rounded-md text-[13px] text-white/60 hover:bg-white/5 hover:text-white/90 transition-colors"
          >
            <span className="flex-shrink-0">{ICON_LOGOUT}</span>
            Log ud
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="md:hidden sticky top-0 z-30 bg-[#1A1A1A] text-white px-4 py-3 flex items-center justify-between border-b border-white/[0.08]">
        <div className="flex items-center gap-2">
          <img src="/logo.png" alt="" className="w-7 h-7" />
          <p className="font-serif text-[16px]">Design Klip</p>
        </div>
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label={mobileOpen ? 'Luk menu' : 'Åbn menu'}
          className="text-white/85 hover:text-white p-1"
        >
          {mobileOpen ? ICON_X : ICON_MENU}
        </button>
      </header>

      {/* Mobile dropdown */}
      {mobileOpen && (
        <div className="md:hidden bg-[#1A1A1A] text-white border-b border-white/[0.08] px-3 py-2 space-y-1">
          <div className="px-3 py-2 text-[12px] text-white/60">
            {barberName ?? 'Admin'}
            {role === 'super_admin' && ' · Ejer'}
          </div>
          {NAV_ITEMS.map((item) => navLink(item, () => setMobileOpen(false)))}
          <button
            onClick={() => {
              setMobileOpen(false)
              signOut()
            }}
            className="flex items-center gap-2.5 w-full px-3 py-2 rounded-md text-[13px] text-white/60 hover:bg-white/5 hover:text-white/90 transition-colors"
          >
            <span className="flex-shrink-0">{ICON_LOGOUT}</span>
            Log ud
          </button>
        </div>
      )}

      {/* Main */}
      <main className="flex-1 flex flex-col md:h-screen md:overflow-hidden">
        {/* Page title bar */}
        <div className="bg-white border-b border-gray-200 px-4 md:px-6 py-3.5 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <img src="/logo.png" alt="" className="w-7 h-7" />
            <h1 className="text-base font-medium text-gray-900">{pageTitle}</h1>
          </div>
        </div>

        {/* Content area — fixed frame on desktop; pages handle their own internal scroll */}
        <div className="flex-1 p-4 md:p-6 md:overflow-hidden md:flex md:flex-col md:min-h-0">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
