import { useParams } from 'react-router-dom'

export default function PostDetailPage() {
  const { id } = useParams<{ id: string }>()

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-4">Post Detail</h1>
      <p className="text-gray-500 text-sm mb-2">Post ID: {id}</p>
      <p className="text-gray-500">Metrics, score breakdown, insights — coming in Phase 4.</p>
    </div>
  )
}
