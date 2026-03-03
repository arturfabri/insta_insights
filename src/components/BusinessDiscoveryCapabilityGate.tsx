import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useAccountCapabilities } from '@/hooks/useAccountCapabilities'
import { canUseBusinessDiscovery } from '@/lib/account-capabilities'

interface BusinessDiscoveryCapabilityGateProps {
  accountId: string
  children: ReactNode
}

export default function BusinessDiscoveryCapabilityGate({
  accountId,
  children,
}: BusinessDiscoveryCapabilityGateProps) {
  const { capabilities, loading } = useAccountCapabilities(accountId)

  if (loading) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-500">
        Checking Meta capability state…
      </div>
    )
  }

  if (canUseBusinessDiscovery(capabilities)) {
    return <>{children}</>
  }

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-6">
      <h2 className="text-base font-semibold text-amber-800">Meta connection required</h2>
      <p className="mt-2 text-sm text-amber-700">
        Business Discovery requires the optional Meta connection for this Instagram account.
      </p>
      <Link
        to={`/connect?accountId=${accountId}`}
        className="mt-4 inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
      >
        Connect Meta
      </Link>
    </div>
  )
}
