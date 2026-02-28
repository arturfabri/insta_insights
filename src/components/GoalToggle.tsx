import { useGoal } from '@/context/GoalContext'
import type { Goal } from '@/context/GoalContext'

export default function GoalToggle() {
  const { goal, setGoal } = useGoal()

  return (
    <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
      {(['growth', 'leads'] as Goal[]).map((g) => (
        <button
          key={g}
          onClick={() => setGoal(g)}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
            goal === g
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          {g === 'growth' ? 'Growth' : 'Leads & Sales'}
        </button>
      ))}
    </div>
  )
}
