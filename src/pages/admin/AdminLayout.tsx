import { Navigate, Outlet, Link, useLocation } from 'react-router-dom'
import { useAuth } from '../../lib/auth'

const NAV_ITEMS = [
  { path: '/admin/i-dag', label: 'I dag', icon: '📋' },
  { path: '/admin/opret-booking', label: 'Opret booking', icon: '➕' },
  { path: '/admin/kunder', label: 'Kunder', icon: '👤' },
  { path: '/admin/noter', label: 'Noter', icon: '📝' },
]

export function AdminLayout() {
  const { user, role, barberName, loading, signOut } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-sm text-ink-subtle">Henter…</p>
      </div>
    )
  }

  if (!user || !role) {
    return <Navigate to="/admin/login" replace />
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Sidebar */}
      <aside className="w-full md:w-56 bg-white border-b md:border-b-0 md:border-r border-border md:min-h-screen flex-shrink-0 flex flex-col">
        <div className="px-4 py-4 border-b border-border">
          <Link to="/" className="block">
            <img src="/logo.png" alt="Design Klip" className="h-8 w-auto" />
          </Link>
          <p className="text-xs text-ink-muted mt-2">
            {barberName ?? 'Admin'}
            {role === 'super_admin' && ' (ejer)'}
          </p>
        </div>

        <nav className="flex md:flex-col gap-1 p-2 overflow-x-auto md:overflow-visible">
          {NAV_ITEMS.map((item) => {
            const isActive =
              location.pathname === item.path ||
              (item.path === '/admin/i-dag' && location.pathname === '/admin')
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-sm text-sm whitespace-nowrap transition-colors ${
                  isActive
                    ? 'bg-accent/10 text-accent-deep font-medium'
                    : 'text-ink-muted hover:bg-surface hover:text-ink'
                }`}
              >
                <span className="text-base">{item.icon}</span>
                {item.label}
              </Link>
            )
          })}
        </nav>

        <div className="hidden md:block mt-auto p-2 border-t border-border">
          <button
            onClick={signOut}
            className="w-full text-left px-3 py-2 text-xs text-ink-subtle hover:text-ink transition-colors"
          >
            Log ud
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 bg-surface min-h-screen">
        <div className="p-4 md:p-6 max-w-4xl">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
