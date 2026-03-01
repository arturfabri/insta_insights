import { Link } from 'react-router-dom'

interface EmptyStateProps {
  icon?: string
  title: string
  description: string
  action?: {
    label: string
    href: string
  }
}

export default function EmptyState({
  icon = '📭',
  title,
  description,
  action,
}: EmptyStateProps) {
  return (
    <div className="text-center mt-16 px-4">
      <div className="text-5xl mb-4">{icon}</div>
      <h2 className="text-lg font-semibold text-gray-900 mb-2">{title}</h2>
      <p className="text-sm text-gray-500 mb-6 max-w-xs mx-auto">{description}</p>
      {action && (
        <Link
          to={action.href}
          className="inline-flex items-center gap-2 bg-brand-600 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-brand-700 transition-colors"
        >
          {action.label}
        </Link>
      )}
    </div>
  )
}
