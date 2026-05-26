import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useOrg } from '../contexts/OrgContext'
import { CreditCard, CheckCircle, AlertTriangle, Clock, ExternalLink, Sparkles } from 'lucide-react'

interface SubscriptionStatus {
  status: string
  plan: string | null
  trial_ends_at: string | null
  subscription_ends_at: string | null
}

const PLANS = [
  {
    id: 'growth',
    name: 'Growth',
    monthlyPrice: 2500,
    annualPrice: 2000,
    desc: 'For procurement teams managing multiple concurrent bids.',
    features: [
      'Up to 25 active projects',
      'Up to 10 user seats',
      'Unlimited AI analysis',
      'Automated RFQ & follow-ups',
      'Bid/No-Bid Decision Engine',
      'Compliance auto-verification',
      'Market rate intelligence',
      'Pricing Matrix with AI markup',
      'Data export',
      'Chat support',
    ],
    popular: true,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    monthlyPrice: 5000,
    annualPrice: 4000,
    desc: 'For large primes and multi-office firms.',
    features: [
      'Unlimited projects & users',
      'Everything in Growth, plus:',
      'Post-award transition',
      'Teaming & JV management',
      'Resource capacity tracking',
      'Relationship intelligence',
      'REST API access',
      'Dedicated onboarding',
      '99.9% uptime SLA',
    ],
  },
]

export default function Billing() {
  const { user } = useAuth()
  const { currentOrg } = useOrg()
  const [subStatus, setSubStatus] = useState<SubscriptionStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [annual, setAnnual] = useState(false)
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null)

  useEffect(() => {
    if (currentOrg) loadStatus()
  }, [currentOrg])

  async function loadStatus() {
    try {
      const res = await fetch('/.netlify/functions/manage-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'status', org_id: currentOrg?.id }),
      })
      const data = await res.json()
      setSubStatus(data)
    } catch {
      setSubStatus({ status: 'no_subscription', plan: null, trial_ends_at: null, subscription_ends_at: null })
    }
    setLoading(false)
  }

  async function handleCheckout(planId: string) {
    setCheckoutLoading(planId)
    try {
      const billingPlan = `${planId}_${annual ? 'annual' : 'monthly'}`
      const res = await fetch('/.netlify/functions/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan_id: billingPlan,
          org_id: currentOrg?.id,
          user_email: user?.email,
        }),
      })
      const data = await res.json()
      if (data.checkout_url) {
        window.location.href = data.checkout_url
      }
    } catch (err) {
      console.error('Checkout failed:', err)
    }
    setCheckoutLoading(null)
  }

  async function handleManage() {
    try {
      const res = await fetch('/.netlify/functions/manage-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'portal', user_email: user?.email }),
      })
      const data = await res.json()
      if (data.portal_url) {
        window.location.href = data.portal_url
      }
    } catch (err) {
      console.error('Portal failed:', err)
    }
  }

  function StatusBadge() {
    if (!subStatus) return null
    const s = subStatus.status

    if (s === 'active') return (
      <div className="flex items-center gap-2 text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-2">
        <CheckCircle size={18} /> Active subscription
      </div>
    )
    if (s === 'trialing') {
      const trialEnd = subStatus.trial_ends_at ? new Date(subStatus.trial_ends_at) : null
      const daysLeft = trialEnd ? Math.max(0, Math.ceil((trialEnd.getTime() - Date.now()) / 86400000)) : 0
      return (
        <div className="flex items-center gap-2 text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2">
          <Clock size={18} /> Trial active — {daysLeft} day{daysLeft !== 1 ? 's' : ''} remaining
        </div>
      )
    }
    if (s === 'past_due') return (
      <div className="flex items-center gap-2 text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2">
        <AlertTriangle size={18} /> Payment past due — please update your payment method
      </div>
    )
    if (s === 'cancelled') return (
      <div className="flex items-center gap-2 text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-2">
        <AlertTriangle size={18} /> Subscription cancelled
      </div>
    )
    return null
  }

  if (loading) {
    return <div className="text-center py-12 text-gray-500">Loading billing information...</div>
  }

  const hasActiveSubscription = subStatus?.status === 'active' || subStatus?.status === 'trialing'

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <CreditCard size={24} className="text-gray-600" /> Billing & Subscription
        </h1>
        <p className="text-sm text-gray-500 mt-1">Manage your Procuvex subscription and payment method</p>
      </div>

      <StatusBadge />

      {hasActiveSubscription && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-gray-900">Current Plan: {subStatus?.plan?.includes('enterprise') ? 'Enterprise' : 'Growth'}</h3>
              <p className="text-sm text-gray-500 mt-1">
                {subStatus?.plan?.includes('annual') ? 'Billed annually' : 'Billed monthly'}
                {subStatus?.subscription_ends_at && ` · Renews ${new Date(subStatus.subscription_ends_at).toLocaleDateString()}`}
              </p>
            </div>
            <button
              onClick={handleManage}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium text-gray-700 transition-colors"
            >
              <ExternalLink size={16} /> Manage Subscription
            </button>
          </div>
        </div>
      )}

      {!hasActiveSubscription && (
        <>
          <div className="flex items-center justify-center gap-4">
            <span className={`text-sm font-medium ${!annual ? 'text-gray-900' : 'text-gray-500'}`}>Monthly</span>
            <button
              onClick={() => setAnnual(!annual)}
              className={`relative w-12 h-6 rounded-full transition-colors ${annual ? 'bg-blue-600' : 'bg-gray-300'}`}
            >
              <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${annual ? 'translate-x-6' : 'translate-x-0.5'}`} />
            </button>
            <span className={`text-sm font-medium ${annual ? 'text-gray-900' : 'text-gray-500'}`}>
              Annual <span className="text-green-600 font-bold">(Save 20%)</span>
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {PLANS.map(plan => (
              <div
                key={plan.id}
                className={`relative bg-white rounded-xl p-6 ${
                  plan.popular ? 'border-2 border-blue-600 shadow-lg' : 'border border-gray-200'
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-blue-600 text-white text-xs font-bold rounded-full flex items-center gap-1">
                    <Sparkles size={12} /> Recommended
                  </div>
                )}
                <h3 className="text-lg font-bold text-gray-900">{plan.name}</h3>
                <p className="text-xs text-gray-500 mt-1 mb-4">{plan.desc}</p>
                <div className="mb-4">
                  <span className="text-3xl font-extrabold text-gray-900">
                    ${(annual ? plan.annualPrice : plan.monthlyPrice).toLocaleString()}
                  </span>
                  <span className="text-gray-500 text-sm">/mo{annual ? ' (billed annually)' : ''}</span>
                </div>
                <ul className="space-y-2 mb-6">
                  {plan.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                      <CheckCircle size={14} className="text-blue-500 flex-shrink-0 mt-0.5" /> {f}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => handleCheckout(plan.id)}
                  disabled={!!checkoutLoading}
                  className={`w-full py-3 rounded-lg font-semibold text-sm transition-colors ${
                    plan.popular
                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                      : 'bg-gray-900 text-white hover:bg-gray-800'
                  } disabled:opacity-50`}
                >
                  {checkoutLoading === plan.id ? 'Redirecting...' : 'Start 7-Day Free Trial'}
                </button>
                <p className="text-xs text-gray-400 text-center mt-2">Credit card required — no charge during trial</p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
