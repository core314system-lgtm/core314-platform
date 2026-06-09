import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  Activity, CheckCircle, AlertTriangle, XCircle,
  RefreshCw, Database, Shield, Globe, Cpu, CreditCard,
  Clock,
} from 'lucide-react'
import Header from '../components/Header'
import Footer from '../components/Footer'

const fadeUp = { hidden: { opacity: 0, y: 24 }, visible: { opacity: 1, y: 0 } }
const stagger = { visible: { transition: { staggerChildren: 0.08 } } }

interface ServiceHealth {
  status: 'operational' | 'degraded' | 'outage'
  latency_ms: number
}

interface HealthData {
  status: 'operational' | 'degraded' | 'outage'
  timestamp: string
  version: string
  response_time_ms: number
  services: {
    database: ServiceHealth
    auth: ServiceHealth
    sam_gov: ServiceHealth
    openai: ServiceHealth
    stripe: ServiceHealth
  }
}

const SERVICE_META: Record<string, { label: string; icon: typeof Database; description: string }> = {
  database: { label: 'Database', icon: Database, description: 'PostgreSQL data storage and retrieval' },
  auth: { label: 'Authentication', icon: Shield, description: 'User login and session management' },
  sam_gov: { label: 'SAM.gov Feed', icon: Globe, description: 'Federal opportunity discovery integration' },
  openai: { label: 'AI Engine', icon: Cpu, description: 'Document analysis and compliance generation' },
  stripe: { label: 'Billing', icon: CreditCard, description: 'Subscription and payment processing' },
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'operational') {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm font-medium text-green-700 bg-green-50 border border-green-200 rounded-full px-3 py-1">
        <CheckCircle size={14} /> Operational
      </span>
    )
  }
  if (status === 'degraded') {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-3 py-1">
        <AlertTriangle size={14} /> Degraded
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded-full px-3 py-1">
      <XCircle size={14} /> Outage
    </span>
  )
}

export default function StatusPage() {
  const [health, setHealth] = useState<HealthData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastChecked, setLastChecked] = useState<Date | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const fetchHealth = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    setError(null)

    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 10000)
      const res = await fetch('/.netlify/functions/health', { signal: controller.signal })
      clearTimeout(timeout)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data: HealthData = await res.json()
      setHealth(data)
      setLastChecked(new Date())
    } catch {
      setError('Unable to reach health endpoint. The platform may be experiencing issues.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchHealth()
    const interval = setInterval(() => fetchHealth(true), 60000)
    return () => clearInterval(interval)
  }, [fetchHealth])

  const overallColor = health?.status === 'operational'
    ? 'from-green-600 to-emerald-600'
    : health?.status === 'degraded'
      ? 'from-amber-500 to-orange-500'
      : 'from-red-600 to-rose-600'

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <Header />

      {/* Hero */}
      <section className={`bg-gradient-to-r ${health ? overallColor : 'from-slate-600 to-slate-700'} text-white`}>
        <div className="max-w-5xl mx-auto px-6 py-16 text-center">
          <motion.div initial="hidden" animate="visible" variants={stagger}>
            <motion.div variants={fadeUp} className="flex justify-center mb-4">
              <div className="bg-white/20 rounded-2xl p-4">
                <Activity size={40} />
              </div>
            </motion.div>
            <motion.h1 variants={fadeUp} className="text-4xl font-bold mb-3">
              System Status
            </motion.h1>
            <motion.p variants={fadeUp} className="text-lg text-white/80 mb-6">
              Real-time health monitoring for all Procuvex services
            </motion.p>

            {loading ? (
              <motion.div variants={fadeUp} className="inline-flex items-center gap-2 bg-white/20 rounded-full px-6 py-3">
                <RefreshCw size={18} className="animate-spin" />
                Checking services...
              </motion.div>
            ) : error ? (
              <motion.div variants={fadeUp} className="inline-flex items-center gap-2 bg-red-500/30 rounded-full px-6 py-3">
                <XCircle size={18} />
                Unable to check — see details below
              </motion.div>
            ) : health ? (
              <motion.div variants={fadeUp} className="inline-flex items-center gap-2 bg-white/20 rounded-full px-6 py-3 text-lg font-semibold">
                {health.status === 'operational' ? (
                  <><CheckCircle size={20} /> All Systems Operational</>
                ) : health.status === 'degraded' ? (
                  <><AlertTriangle size={20} /> Partial System Degradation</>
                ) : (
                  <><XCircle size={20} /> Service Disruption Detected</>
                )}
              </motion.div>
            ) : null}
          </motion.div>
        </div>
      </section>

      {/* Services Grid */}
      <section className="max-w-5xl mx-auto px-6 py-12">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-bold text-slate-900">Service Health</h2>
          <div className="flex items-center gap-3">
            {lastChecked && (
              <span className="text-sm text-slate-500 flex items-center gap-1">
                <Clock size={14} />
                Last checked: {lastChecked.toLocaleTimeString()}
              </span>
            )}
            <button
              onClick={() => fetchHealth(true)}
              disabled={refreshing}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg px-3 py-1.5 transition-colors disabled:opacity-50"
            >
              <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>
        </div>

        {error && !health ? (
          <div className="bg-red-50 border border-red-200 rounded-xl p-8 text-center">
            <XCircle size={40} className="mx-auto mb-3 text-red-400" />
            <h3 className="text-lg font-semibold text-red-900 mb-2">Health Check Unavailable</h3>
            <p className="text-sm text-red-700">{error}</p>
            <p className="text-xs text-red-500 mt-3">
              If this persists, please contact <a href="mailto:support@procuvex.com" className="underline">support@procuvex.com</a>
            </p>
          </div>
        ) : (
          <motion.div
            initial="hidden"
            animate="visible"
            variants={stagger}
            className="space-y-3"
          >
            {health && Object.entries(health.services).map(([key, service]) => {
              const meta = SERVICE_META[key]
              if (!meta) return null
              const Icon = meta.icon
              return (
                <motion.div
                  key={key}
                  variants={fadeUp}
                  className="flex items-center justify-between bg-white border border-slate-200 rounded-xl px-6 py-4 hover:shadow-sm transition-shadow"
                >
                  <div className="flex items-center gap-4">
                    <div className={`rounded-lg p-2.5 ${
                      service.status === 'operational' ? 'bg-green-50 text-green-600' :
                      service.status === 'degraded' ? 'bg-amber-50 text-amber-600' :
                      'bg-red-50 text-red-600'
                    }`}>
                      <Icon size={20} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900">{meta.label}</h3>
                      <p className="text-xs text-slate-500">{meta.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-xs text-slate-400 tabular-nums">
                      {service.latency_ms}ms
                    </span>
                    <StatusBadge status={service.status} />
                  </div>
                </motion.div>
              )
            })}
          </motion.div>
        )}

        {/* Response time summary */}
        {health && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-8 bg-slate-50 border border-slate-200 rounded-xl p-6"
          >
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Platform Details</h3>
            <div className="grid grid-cols-3 gap-6 text-center">
              <div>
                <p className="text-2xl font-bold text-slate-900 tabular-nums">{health.response_time_ms}ms</p>
                <p className="text-xs text-slate-500">Total Response Time</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">v{health.version}</p>
                <p className="text-xs text-slate-500">Platform Version</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">99.9%</p>
                <p className="text-xs text-slate-500">Uptime SLA</p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Info section */}
        <div className="mt-12 bg-blue-50 border border-blue-200 rounded-xl p-6">
          <h3 className="font-semibold text-blue-900 mb-2">About This Page</h3>
          <p className="text-sm text-blue-800 leading-relaxed">
            This page checks the real-time health of all Procuvex platform services every 60 seconds.
            Status indicators reflect live connectivity to our database, authentication, AI engine,
            billing system, and SAM.gov integration. For details about our uptime commitment,
            see our <a href="/sla" className="underline font-medium">Service Level Agreement</a>.
            For security practices, visit our <a href="/security" className="underline font-medium">Security</a> page.
          </p>
        </div>
      </section>

      <Footer />
    </div>
  )
}
