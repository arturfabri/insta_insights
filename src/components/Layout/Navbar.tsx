import { useAuth } from '@/context/AuthContext'
import GoalToggle from '@/components/GoalToggle'

export default function Navbar() {
  const { user, signOut } = useAuth()

  return (
    <header className="h-16 border-b border-gray-200 bg-white flex items-center justify-between px-6 shrink-0">
      <GoalToggle />
      <div className="flex items-center gap-3">
        <span className="text-sm text-gray-600">{user?.email}</span>
        <button
          onClick={signOut}
          className="text-sm text-gray-500 hover:text-gray-900 transition-colors"
        >
          Sign out
        </button>
      </div>
    </header>
  )
}
