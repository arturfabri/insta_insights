import { useInstagramAccount } from '@/hooks/useInstagramAccount'
import type { InstagramAccount } from '@/types/database'

interface UseInstagramAccountsResult {
  accounts: InstagramAccount[]
  loading: boolean
  error: string | null
  refetch: () => void
}

/**
 * Compatibility shim for legacy plural consumers.
 * The product only supports one connected Instagram account per user.
 */
export function useInstagramAccounts(): UseInstagramAccountsResult {
  const { account, loading, error, refetch } = useInstagramAccount()

  return {
    accounts: account ? [account] : [],
    loading,
    error,
    refetch,
  }
}
