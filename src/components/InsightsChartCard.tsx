import type { ReactNode } from 'react'

interface InsightsChartCardProps {
  title: string
  description: string
  unavailable?: boolean
  unavailableMessage?: string
  children: ReactNode
}

export default function InsightsChartCard({
  title,
  description,
  unavailable = false,
  unavailableMessage = 'Unavailable for the selected account data.',
  children,
}: InsightsChartCardProps) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-4">
        <h2 className="text-base font-semibold text-gray-900">{title}</h2>
        <p className="mt-1 text-sm text-gray-500">{description}</p>
      </div>
      {unavailable ? (
        <div className="flex min-h-64 items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50 px-6 text-center text-sm text-gray-400">
          {unavailableMessage}
        </div>
      ) : (
        children
      )}
    </section>
  )
}
