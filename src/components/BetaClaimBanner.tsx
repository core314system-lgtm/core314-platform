import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { Gift, Clock, AlertTriangle, ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'

interface BetaStatus {
  beta_program_status: string | null
  beta_coupon_code: string | null
  beta_coupon_expires_at: string | null
  current_week: number
  days_remaining: number
  feedback: Array<{ week_number: number }>
}

export default function BetaClaimBanner() {
  const { user } = useAuth()
  const [status, setStatus] = useState<BetaStatus | null>(null)

  useEffect(() => {
    if (!user) return
    fetch('/.netlify/functions/beta-feedback', { headers: { 'x-user-id': user.id } })
      .then(r => r.json())
      .then(data => setStatus(data))
      .catch(() => {})
  }, [user])

  if (!status) return null

  // Active tester — show feedback progress
  if (status.beta_program_status === 'active' && status.days_remaining > 0) {
    const completedWeeks = status.feedback?.length || 0
    const currentWeek = status.current_week || 1
    const needsFeedback = !status.feedback?.some(f => f.week_number === currentWeek)

    if (!needsFeedback) return null

    return (
      <Link to="/feedback" className="block bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4 hover:bg-blue-100 transition-colors group">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
              <Clock className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="font-medium text-blue-900 text-sm">Week {currentWeek} Feedback Ready</p>
              <p className="text-blue-600 text-xs">{completedWeeks}/4 weeks completed • {status.days_remaining} days remaining</p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-blue-400 group-hover:translate-x-1 transition-transform" />
        </div>
      </Link>
    )
  }

  // Completed — show coupon claim banner
  if (status.beta_program_status === 'completed' && status.beta_coupon_code && status.beta_coupon_expires_at) {
    const expiresAt = new Date(status.beta_coupon_expires_at)
    const msRemaining = expiresAt.getTime() - Date.now()
    const hoursRemaining = Math.max(0, Math.ceil(msRemaining / 3600000))
    const daysRemaining = Math.ceil(hoursRemaining / 24)

    if (msRemaining <= 0) return null

    const isUrgent = hoursRemaining <= 24
    const isWarning = daysRemaining <= 2

    return (
      <div className={`rounded-xl p-4 mb-4 border-2 ${
        isUrgent ? 'bg-red-50 border-red-300' : isWarning ? 'bg-amber-50 border-amber-300' : 'bg-green-50 border-green-300'
      }`}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
              isUrgent ? 'bg-red-100' : isWarning ? 'bg-amber-100' : 'bg-green-100'
            }`}>
              {isUrgent ? <AlertTriangle className="w-5 h-5 text-red-600" /> : <Gift className="w-5 h-5 text-green-600" />}
            </div>
            <div>
              <p className={`font-semibold text-sm ${isUrgent ? 'text-red-900' : isWarning ? 'text-amber-900' : 'text-green-900'}`}>
                {isUrgent ? 'Last Chance — Discount Expires Today!' : 'Claim Your 25% Lifetime Discount'}
              </p>
              <p className={`text-xs mt-0.5 ${isUrgent ? 'text-red-600' : isWarning ? 'text-amber-600' : 'text-green-600'}`}>
                {isUrgent
                  ? `Only ${hoursRemaining} hour${hoursRemaining !== 1 ? 's' : ''} remaining!`
                  : `${daysRemaining} day${daysRemaining !== 1 ? 's' : ''} remaining to claim`}
              </p>
              <div className={`mt-2 inline-block px-3 py-1 rounded-md font-mono text-sm font-bold ${
                isUrgent ? 'bg-red-100 text-red-800' : isWarning ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800'
              }`}>
                {status.beta_coupon_code}
              </div>
            </div>
          </div>
          <Link to="/billing"
            className={`px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap ${
              isUrgent ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-green-600 text-white hover:bg-green-700'
            } transition-colors`}>
            Claim My Discount
          </Link>
        </div>

        {/* Countdown bar */}
        <div className="mt-3 h-1.5 bg-white/50 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              isUrgent ? 'bg-red-500' : isWarning ? 'bg-amber-500' : 'bg-green-500'
            }`}
            style={{ width: `${Math.max(0, (msRemaining / (5 * 86400000)) * 100)}%` }}
          />
        </div>
      </div>
    )
  }

  // Expired
  if (status.beta_program_status === 'expired') {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-4">
        <div className="flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-gray-400" />
          <div>
            <p className="font-medium text-gray-700 text-sm">Founding Partner Discount Expired</p>
            <p className="text-gray-500 text-xs">Your discount window has passed. Subscribe at regular pricing to continue using Procuvex.</p>
          </div>
          <Link to="/billing" className="ml-auto px-4 py-2 bg-gray-800 text-white rounded-lg text-sm font-medium hover:bg-gray-900 transition-colors">
            View Plans
          </Link>
        </div>
      </div>
    )
  }

  return null
}
