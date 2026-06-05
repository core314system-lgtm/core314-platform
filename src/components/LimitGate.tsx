import { Link } from 'react-router-dom'
import { AlertTriangle, Sparkles } from 'lucide-react'
import { useTier } from '../hooks/useTier'

interface LimitGateProps {
  currentCount: number
  limitKey: 'max_projects' | 'max_seats' | 'max_subcontractors'
  entityName: string
  children: React.ReactNode
}

/**
 * Wraps an "add new" action (like creating a project). If the current count
 * has hit the tier limit, shows an upgrade prompt instead.
 */
export default function LimitGate({ currentCount, limitKey, entityName, children }: LimitGateProps) {
  const { getLimit, isEnterprise, loading } = useTier()

  if (loading) return <>{children}</>

  const limit = getLimit(limitKey)
  if (currentCount < limit) {
    return <>{children}</>
  }

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-center">
      <AlertTriangle className="w-6 h-6 text-amber-500 mx-auto mb-2" />
      <p className="text-sm font-medium text-amber-800 mb-1">
        {entityName} limit reached ({currentCount}/{limit})
      </p>
      <p className="text-xs text-amber-600 mb-3">
        Your Growth plan allows up to {limit} {entityName.toLowerCase()}.
        {!isEnterprise && ' Upgrade to Enterprise for unlimited access.'}
      </p>
      {!isEnterprise && (
        <Link
          to="/billing"
          className="inline-flex items-center gap-1 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700"
        >
          <Sparkles size={14} /> Upgrade Plan
        </Link>
      )}
    </div>
  )
}
