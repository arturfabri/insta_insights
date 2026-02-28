import { useGoal } from '@/context/GoalContext'

export default function DashboardPage() {
  const { goal } = useGoal()

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <span className="text-sm text-gray-500">
          Goal: <span className="font-medium text-brand-600">{goal === 'growth' ? 'Growth' : 'Leads & Sales'}</span>
        </span>
      </div>
      <p className="text-gray-500">Post grid with scores — coming in Phase 4.</p>
    </div>
  )
}
