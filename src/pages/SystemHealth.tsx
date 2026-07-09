import { useState, useEffect, useCallback } from 'react'
import {
  Activity, CheckCircle, AlertTriangle, XCircle,
  RefreshCw, Database, Shield, Globe, Cpu, CreditCard,
  Clock, Server, Zap, FileText, ExternalLink,
} from 'lucide-react'

interface ServiceHealth {
  status: 'operational' | 'degraded' | 'outage'
  latency_ms: number
  message?: string
}

interface HealthData {
  status: 'operational' | 'degraded' | 'outage'
  timestamp: string
  version: string
  response_time_ms: number
  services: Record<string, ServiceHealth>
}

const SERVICE_META: Record<string, { label: string; icon: typeof Database; description: string }> = {
  database: { label: 'Supabase PostgreSQL', icon: Database, description: 'Primary data store — organizations, projects, documents, compliance data' },
  auth: { label: 'Supabase Auth', icon: Shield, description: 'JWT authentication, session management, password reset' },
  sam_gov: { label: 'SAM.gov API', icon: Globe, description: 'Federal opportunity search, document downloads, NAICS lookup' },
  openai: { label: 'OpenAI API', icon: Cpu, description: 'GPT-4o-mini for document analysis, compliance matrices, Q&A' },
  stripe: { label: 'Stripe API', icon: CreditCard, description: 'Subscription billing, checkout sessions, webhook processing' },
}

const RUNBOOK_ENTRIES: Array<{ service: string; scenario: string; steps: string[] }> = [
  {
    service: 'Database',
    scenario: 'Database shows degraded or outage',
    steps: [
      'Check Supabase dashboard: https://supabase.com/dashboard — verify project is running',
      'Check if connection pool is exhausted (Supabase → Settings → Database → Connection Pooling)',
      'Verify VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in Netlify env vars',
      'If outage persists > 15 min, check Supabase status page: https://status.supabase.com',
      'For data recovery: Supabase provides automated daily backups with 7-day retention',
    ],
  },
  {
    service: 'Authentication',
    scenario: 'Auth service unreachable',
    steps: [
      'Auth runs on Supabase infrastructure — if DB is up but auth is down, check Supabase status page',
      'Verify email confirmation is working (Supabase → Auth → Settings → Email Templates)',
      'Check if SMTP provider (SendGrid) is delivering emails — verify SENDGRID_API_KEY in Netlify',
      'For locked-out admin: use Supabase SQL editor to reset password or create emergency session',
    ],
  },
  {
    service: 'SAM.gov API',
    scenario: 'SAM.gov shows degraded or outage',
    steps: [
      'SAM.gov is a government API — outages are common during maintenance windows (usually weekends)',
      'The Opportunity Feed will show cached results if available; new searches will fail gracefully',
      'No action needed from your side — the circuit breaker prevents cascading failures',
      'If persistent (> 24h), check SAM.gov status: https://sam.gov/content/status',
      'Retry logic (3 attempts with exponential backoff) handles transient failures automatically',
    ],
  },
  {
    service: 'OpenAI API',
    scenario: 'AI engine shows degraded or outage',
    steps: [
      'Check OpenAI status: https://status.openai.com',
      'Verify OPENAI_API_KEY is valid — test with: curl https://api.openai.com/v1/models -H "Authorization: Bearer $KEY"',
      'Check billing at https://platform.openai.com/account/billing — ensure account has credits',
      'AI features degrade gracefully — users can still upload docs, but analysis won\'t run',
      'If rate-limited (429): wait and retry. Rate limits reset per-minute for GPT-4o-mini',
      'To rotate key: OpenAI dashboard → API Keys → Create new → update OPENAI_API_KEY in Netlify',
    ],
  },
  {
    service: 'Stripe API',
    scenario: 'Billing shows degraded or outage',
    steps: [
      'Check Stripe status: https://status.stripe.com',
      'Verify STRIPE_SECRET_KEY is valid in Netlify environment variables',
      'Check webhook endpoint health: Stripe dashboard → Webhooks → verify endpoint is active',
      'If webhook is failing: check Netlify function logs for stripe-webhook errors',
      'Stripe handles subscription renewals automatically — brief outages don\'t affect active subscriptions',
      'For checkout issues: verify STRIPE_GROWTH_PRICE_ID and STRIPE_ENTERPRISE_PRICE_ID are correct',
    ],
  },
  {
    service: 'General',
    scenario: 'Full platform outage (all services down)',
    steps: [
      'Check Netlify status: https://www.netlifystatus.com — hosting may be down',
      'Verify DNS: check if procuvex.com resolves correctly (nslookup procuvex.com)',
      'Check Netlify dashboard → Deploys → verify latest deploy succeeded',
      'For rollback: Netlify → Deploys → click any previous successful deploy → "Publish deploy"',
      'If Netlify is healthy but site is down: check _redirects and netlify.toml for routing issues',
    ],
  },
]

function StatusIcon({ status }: { status: string }) {
  if (status === 'operational') return <CheckCircle size={18} className="text-green-500" />
  if (status === 'degraded') return <AlertTriangle size={18} className="text-amber-500" />
  return <XCircle size={18} className="text-red-500" />
}

function StatusBadge({ status }: { status: string }) {
  const colors = {
    operational: 'bg-green-100 text-green-800 border-green-200',
    degraded: 'bg-amber-100 text-amber-800 border-amber-200',
    outage: 'bg-red-100 text-red-800 border-red-200',
  }
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium border rounded-full px-2.5 py-0.5 ${colors[status as keyof typeof colors] || colors.outage}`}>
      <StatusIcon status={status} />
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  )
}

export default function SystemHealth() {
  const [health, setHealth] = useState<HealthData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastChecked, setLastChecked] = useState<Date | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [showRunbook, setShowRunbook] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(true)

  const fetchHealth = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    setError(null)

    try {
      const res = await fetch('/.netlify/functions/health?detailed=true')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data: HealthData = await res.json()
      setHealth(data)
      setLastChecked(new Date())
    } catch {
      setError('Unable to reach health endpoint.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchHealth()
    if (!autoRefresh) return
    const interval = setInterval(() => fetchHealth(true), 30000)
    return () => clearInterval(interval)
  }, [fetchHealth, autoRefresh])

  const degradedServices = health
    ? Object.entries(health.services).filter(([, s]) => s.status !== 'operational')
    : []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-blue-100 rounded-lg p-2">
            <Activity size={24} className="text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">System Health</h1>
            <p className="text-sm text-gray-500">Real-time platform monitoring — admin only</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded border-gray-300"
            />
            Auto-refresh (30s)
          </label>
          <button
            onClick={() => fetchHealth(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-lg px-3 py-1.5 hover:bg-blue-100 disabled:opacity-50"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            Refresh Now
          </button>
        </div>
      </div>

      {/* Overall status banner */}
      {health && (
        <div className={`rounded-xl p-5 flex items-center justify-between ${
          health.status === 'operational' ? 'bg-green-50 border border-green-200' :
          health.status === 'degraded' ? 'bg-amber-50 border border-amber-200' :
          'bg-red-50 border border-red-200'
        }`}>
          <div className="flex items-center gap-3">
            {health.status === 'operational' ? (
              <CheckCircle size={24} className="text-green-600" />
            ) : health.status === 'degraded' ? (
              <AlertTriangle size={24} className="text-amber-600" />
            ) : (
              <XCircle size={24} className="text-red-600" />
            )}
            <div>
              <p className="font-semibold text-gray-900">
                {health.status === 'operational' ? 'All Systems Operational' :
                 health.status === 'degraded' ? `${degradedServices.length} Service${degradedServices.length > 1 ? 's' : ''} Degraded` :
                 'Service Disruption'}
              </p>
              <p className="text-xs text-gray-500">
                Checked: {lastChecked?.toLocaleString()} · Response: {health.response_time_ms}ms · v{health.version}
              </p>
            </div>
          </div>
          <a
            href="/status"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
          >
            Public Status Page <ExternalLink size={14} />
          </a>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
          <XCircle size={20} className="text-red-500" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <RefreshCw size={24} className="animate-spin text-blue-500" />
          <span className="ml-2 text-gray-500">Running health checks...</span>
        </div>
      ) : health ? (
        <>
          {/* Services detail table */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-3 bg-gray-50 border-b border-gray-200">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                <Server size={16} />
                Service Details
              </h2>
            </div>
            <div className="divide-y divide-gray-100">
              {Object.entries(health.services).map(([key, service]) => {
                const meta = SERVICE_META[key]
                if (!meta) return null
                const Icon = meta.icon
                return (
                  <div key={key} className="flex items-center justify-between px-5 py-4 hover:bg-gray-50">
                    <div className="flex items-center gap-4">
                      <div className={`rounded-lg p-2 ${
                        service.status === 'operational' ? 'bg-green-50 text-green-600' :
                        service.status === 'degraded' ? 'bg-amber-50 text-amber-600' :
                        'bg-red-50 text-red-600'
                      }`}>
                        <Icon size={18} />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{meta.label}</p>
                        <p className="text-xs text-gray-500">{meta.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <p className="text-sm font-mono text-gray-700 tabular-nums">{service.latency_ms}ms</p>
                        <p className="text-xs text-gray-400">latency</p>
                      </div>
                      {service.message && (
                        <div className="max-w-48">
                          <p className="text-xs text-amber-600 truncate" title={service.message}>{service.message}</p>
                        </div>
                      )}
                      <StatusBadge status={service.status} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Quick metrics */}
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
              <Zap size={20} className="mx-auto mb-2 text-blue-500" />
              <p className="text-2xl font-bold text-gray-900 tabular-nums">{health.response_time_ms}ms</p>
              <p className="text-xs text-gray-500">Total Check Time</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
              <CheckCircle size={20} className="mx-auto mb-2 text-green-500" />
              <p className="text-2xl font-bold text-gray-900">
                {Object.values(health.services).filter(s => s.status === 'operational').length}/{Object.keys(health.services).length}
              </p>
              <p className="text-xs text-gray-500">Services Healthy</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
              <Clock size={20} className="mx-auto mb-2 text-purple-500" />
              <p className="text-2xl font-bold text-gray-900">99.9%</p>
              <p className="text-xs text-gray-500">Uptime SLA</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
              <Server size={20} className="mx-auto mb-2 text-indigo-500" />
              <p className="text-2xl font-bold text-gray-900">v{health.version}</p>
              <p className="text-xs text-gray-500">Platform Version</p>
            </div>
          </div>
        </>
      ) : null}

      {/* Operational Runbook */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <button
          onClick={() => setShowRunbook(!showRunbook)}
          className="w-full px-5 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <FileText size={18} className="text-gray-600" />
            <div className="text-left">
              <p className="font-semibold text-gray-900">Operational Runbook</p>
              <p className="text-xs text-gray-500">Step-by-step recovery procedures for each service</p>
            </div>
          </div>
          <span className="text-sm text-blue-600">{showRunbook ? 'Hide' : 'Show'}</span>
        </button>

        {showRunbook && (
          <div className="border-t border-gray-200 divide-y divide-gray-100">
            {RUNBOOK_ENTRIES.map((entry, idx) => {
              const isAffected = health && Object.entries(health.services).some(
                ([key, s]) => s.status !== 'operational' && SERVICE_META[key]?.label.includes(entry.service)
              )
              return (
                <div
                  key={idx}
                  className={`px-5 py-4 ${isAffected ? 'bg-amber-50' : ''}`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    {isAffected && <AlertTriangle size={14} className="text-amber-500" />}
                    <h4 className="font-medium text-gray-900">{entry.service}: {entry.scenario}</h4>
                  </div>
                  <ol className="text-sm text-gray-600 space-y-1.5 pl-5 list-decimal">
                    {entry.steps.map((step, si) => (
                      <li key={si} className="leading-relaxed">{step}</li>
                    ))}
                  </ol>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* External status links */}
      <div className="bg-gray-50 rounded-xl border border-gray-200 p-5">
        <h3 className="font-semibold text-gray-900 mb-3">External Service Status Pages</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: 'Supabase', url: 'https://status.supabase.com' },
            { label: 'OpenAI', url: 'https://status.openai.com' },
            { label: 'Stripe', url: 'https://status.stripe.com' },
            { label: 'Netlify', url: 'https://www.netlifystatus.com' },
            { label: 'SAM.gov', url: 'https://sam.gov/content/status' },
          ].map((link) => (
            <a
              key={link.label}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 bg-white rounded-lg border border-gray-200 px-3 py-2 hover:bg-blue-50 transition-colors"
            >
              <ExternalLink size={12} />
              {link.label}
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}
