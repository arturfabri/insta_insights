import { NavLink } from 'react-router-dom'

const navItems = [
  { to: '/', label: 'Dashboard', icon: '📊' },
  { to: '/recommendations', label: 'Recommendations', icon: '✨' },
  { to: '/connect', label: 'Connections', icon: '🔗' },
]

interface SidebarProps {
  /** Called when a nav item is clicked — used to close the mobile drawer */
  onClose: () => void
}

export default function Sidebar({ onClose }: SidebarProps) {
  return (
    <aside className="w-56 h-full shrink-0 border-r border-gray-200 bg-white flex flex-col">
      <div className="h-16 flex items-center px-6 border-b border-gray-200 shrink-0">
        <span className="font-semibold text-gray-900 tracking-tight">Insta Insights</span>
      </div>
      <nav className="flex-1 p-3 flex flex-col gap-1" aria-label="Main navigation">
        {navItems.map(({ to, label, icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            onClick={onClose}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-brand-50 text-brand-700'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`
            }
          >
            <span aria-hidden="true">{icon}</span>
            {label}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}
