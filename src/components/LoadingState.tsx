interface LoadingStateProps {
  /** Number of skeleton cards to render (default: 8) */
  count?: number
}

function SkeletonCard() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden animate-pulse">
      {/* Thumbnail */}
      <div className="bg-gray-200 aspect-square" />
      {/* Content */}
      <div className="p-3 space-y-2">
        <div className="h-3 bg-gray-200 rounded w-3/4" />
        <div className="h-3 bg-gray-200 rounded w-1/2" />
        <div className="flex justify-between items-center pt-1">
          <div className="flex gap-2">
            <div className="h-5 w-12 bg-gray-200 rounded-full" />
            <div className="h-5 w-12 bg-gray-200 rounded-full" />
          </div>
          <div className="h-8 w-8 bg-gray-200 rounded-full" />
        </div>
      </div>
    </div>
  )
}

export default function LoadingState({ count = 8 }: LoadingStateProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  )
}
