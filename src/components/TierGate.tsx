import { Link } from 'react-router-dom'
import { Lock, Sparkles } from 'lucide-react'
import { useTier } from '../hooks/useTier'

interface TierGateProps {
  feature: string
  children: React.ReactNode
  fallback?: React.ReactNode
  inline?: boolean
}

/**
 * Wraps content that requires a specific tier. If the user's plan doesn't include
 * the feature, shows an upgrade prompt instead of the children.
 * 
 * `feature` must match one of the ENTERPRISE_ONLY_FEATURES keys in useTier.
 * `inline` renders a compact inline badge instead of a full-page overlay.
 */
export default function TierGate({ feature, children, fallback, inline }: TierGateProps) {
  const { canAccess, loading, plan } = useTier()

  if (loading) return null

  if (canAccess(feature)) {
    return <>{children}</>
  }

  if (fallback) return <>{fallback}</>

  if (inline) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-400">
        <Lock size={14} />
        <span>Enterprise feature</span>
        <Link
          to="/billing"
          className="text-blue-600 hover:text-blue-700 font-medium underline"
        >
          Upgrade
        </Link>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center py-16 px-8 text-center">
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-100 to-blue-100 flex items-center justify-center mb-4">
        <Sparkles className="w-8 h-8 text-purple-600" />
      </div>
      <h2 className="text-xl font-bold text-gray-900 mb-2">Enterprise Feature</h2>
      <p className="text-gray-500 max-w-md mb-6">
        This feature is available on the Enterprise plan. Upgrade to unlock unlimited projects,
        advanced intelligence, and premium support.
      </p>
      <Link
        to="/billing"
        className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all shadow-lg"
      >
        <Sparkles size={18} />
        Upgrade to Enterprise
      </Link>
      {plan === 'none' && (
        <p className="text-xs text-gray-400 mt-4">
          No active subscription.{' '}
          <Link to="/billing" className="text-blue-600 hover:underline">Start your free trial</Link>
        </p>
      )}
    </div>
  )
}
