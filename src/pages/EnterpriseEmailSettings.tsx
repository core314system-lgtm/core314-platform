import { useState, useEffect } from 'react'
import { Mail, Globe, CheckCircle, AlertCircle, Loader2, Copy, Trash2, RefreshCw, Palette } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

interface EmailDomain {
  id: string
  domain: string
  from_name: string
  from_email: string
  reply_to_email: string | null
  status: 'pending' | 'verifying' | 'verified' | 'failed'
  spf_record: string | null
  spf_verified: boolean
  dkim_selector: string | null
  dkim_record: string | null
  dkim_verified: boolean
  tracking_cname: string | null
  tracking_verified: boolean
  logo_url: string | null
  brand_color: string
  footer_text: string | null
  verified_at: string | null
  created_at: string
}

interface DnsRecords {
  spf: { record_type: string; name: string; value: string } | null
  dkim: { record_type: string; name: string; value: string } | null
  cname: { record_type: string; name: string; value: string } | null
}

const API_BASE = '/.netlify/functions/enterprise-email-domains'

export default function EnterpriseEmailSettings() {
  const { user } = useAuth()
  const [domains, setDomains] = useState<EmailDomain[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [verifying, setVerifying] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [showBranding, setShowBranding] = useState<string | null>(null)
  const [_dnsRecords, setDnsRecords] = useState<DnsRecords | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Form state
  const [newDomain, setNewDomain] = useState('')
  const [newFromName, setNewFromName] = useState('')
  const [newFromEmail, setNewFromEmail] = useState('')
  const [newReplyTo, setNewReplyTo] = useState('')

  // Branding form
  const [brandColor, setBrandColor] = useState('#4F46E5')
  const [logoUrl, setLogoUrl] = useState('')
  const [footerText, setFooterText] = useState('')

  useEffect(() => {
    loadDomains()
  }, [])

  async function loadDomains() {
    setLoading(true)
    try {
      const resp = await fetch(API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': user?.id || '' },
        body: JSON.stringify({ action: 'list-domains' }),
      })
      const data = await resp.json()
      if (data.domains) setDomains(data.domains)
    } catch {
      setError('Failed to load domains')
    }
    setLoading(false)
  }

  async function handleAddDomain(e: React.FormEvent) {
    e.preventDefault()
    setAdding(true)
    setError(null)

    try {
      const resp = await fetch(API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': user?.id || '' },
        body: JSON.stringify({
          action: 'add-domain',
          domain: newDomain,
          from_name: newFromName || 'Notifications',
          from_email: newFromEmail || `notifications@${newDomain}`,
          reply_to_email: newReplyTo || null,
        }),
      })
      const data = await resp.json()

      if (data.error) {
        setError(data.error)
      } else {
        setDnsRecords(data.dns_records)
        setShowAddForm(false)
        setNewDomain('')
        setNewFromName('')
        setNewFromEmail('')
        setNewReplyTo('')
        await loadDomains()
      }
    } catch {
      setError('Failed to add domain')
    }
    setAdding(false)
  }

  async function handleVerify(domainId: string) {
    setVerifying(domainId)
    try {
      const resp = await fetch(API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': user?.id || '' },
        body: JSON.stringify({ action: 'check-dns', domain_id: domainId }),
      })
      const data = await resp.json()
      if (data.error) {
        setError(data.error)
      }
      await loadDomains()
    } catch {
      setError('Verification check failed')
    }
    setVerifying(null)
  }

  async function handleRemove(domainId: string) {
    if (!confirm('Remove this domain? Emails will revert to platform default.')) return

    try {
      await fetch(API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': user?.id || '' },
        body: JSON.stringify({ action: 'remove-domain', domain_id: domainId }),
      })
      await loadDomains()
    } catch {
      setError('Failed to remove domain')
    }
  }

  async function handleUpdateBranding(domainId: string) {
    try {
      await fetch(API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': user?.id || '' },
        body: JSON.stringify({
          action: 'update-branding',
          domain_id: domainId,
          brand_color: brandColor,
          logo_url: logoUrl || null,
          footer_text: footerText || null,
        }),
      })
      setShowBranding(null)
      await loadDomains()
    } catch {
      setError('Failed to update branding')
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text)
  }

  function StatusBadge({ status }: { status: string }) {
    const colors: Record<string, string> = {
      verified: 'bg-green-100 text-green-800',
      verifying: 'bg-amber-100 text-amber-800',
      pending: 'bg-slate-100 text-slate-800',
      failed: 'bg-red-100 text-red-800',
    }
    return (
      <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${colors[status] || colors.pending}`}>
        {status === 'verified' && <CheckCircle className="inline h-3 w-3 mr-1" />}
        {status === 'verifying' && <Loader2 className="inline h-3 w-3 mr-1 animate-spin" />}
        {status === 'failed' && <AlertCircle className="inline h-3 w-3 mr-1" />}
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    )
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Mail className="h-6 w-6 text-blue-600" />
            Email Domain Settings
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Configure your organization's custom sending domain for branded email communications.
          </p>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
        >
          <Globe className="h-4 w-4" />
          Add Domain
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center gap-2">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {error}
          <button onClick={() => setError(null)} className="ml-auto text-red-500 hover:text-red-700">&times;</button>
        </div>
      )}

      {/* Add Domain Form */}
      {showAddForm && (
        <div className="mb-6 p-6 bg-white border border-slate-200 rounded-xl shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Add Custom Sending Domain</h3>
          <form onSubmit={handleAddDomain} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Domain</label>
                <input
                  type="text"
                  value={newDomain}
                  onChange={e => setNewDomain(e.target.value)}
                  placeholder="mail.yourcompany.com"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
                <p className="text-xs text-slate-400 mt-1">Use a subdomain (e.g., mail.yourco.com) to protect your main domain</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">From Name</label>
                <input
                  type="text"
                  value={newFromName}
                  onChange={e => setNewFromName(e.target.value)}
                  placeholder="Your Company"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">From Email</label>
                <input
                  type="email"
                  value={newFromEmail}
                  onChange={e => setNewFromEmail(e.target.value)}
                  placeholder="notifications@mail.yourcompany.com"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Reply-To Email (optional)</label>
                <input
                  type="email"
                  value={newReplyTo}
                  onChange={e => setNewReplyTo(e.target.value)}
                  placeholder="support@yourcompany.com"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={adding}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
              >
                {adding && <Loader2 className="h-4 w-4 animate-spin" />}
                Add Domain
              </button>
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-4 py-2 bg-slate-100 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-200"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Domain List */}
      {loading ? (
        <div className="flex items-center justify-center py-12 text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading domains...
        </div>
      ) : domains.length === 0 ? (
        <div className="text-center py-16 bg-white border border-slate-200 rounded-xl">
          <Globe className="h-12 w-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-700 mb-2">No Custom Domains</h3>
          <p className="text-sm text-slate-500 mb-6 max-w-md mx-auto">
            Add your organization's sending domain to send branded emails through Procuvex.
            All notifications, RFQs, and outreach will use your domain and branding.
          </p>
          <button
            onClick={() => setShowAddForm(true)}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
          >
            Add Your First Domain
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {domains.map(domain => (
            <div key={domain.id} className="bg-white border border-slate-200 rounded-xl p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg font-semibold text-slate-900 font-mono">{domain.domain}</h3>
                    <StatusBadge status={domain.status} />
                  </div>
                  <p className="text-sm text-slate-500 mt-1">
                    Sends as: <span className="font-medium">{domain.from_name} &lt;{domain.from_email}&gt;</span>
                    {domain.reply_to_email && <> · Reply-to: {domain.reply_to_email}</>}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setShowBranding(showBranding === domain.id ? null : domain.id)
                      setBrandColor(domain.brand_color || '#4F46E5')
                      setLogoUrl(domain.logo_url || '')
                      setFooterText(domain.footer_text || '')
                    }}
                    className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="Branding settings"
                  >
                    <Palette className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleVerify(domain.id)}
                    disabled={verifying === domain.id}
                    className="p-2 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                    title="Re-check DNS"
                  >
                    {verifying === domain.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  </button>
                  <button
                    onClick={() => handleRemove(domain.id)}
                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Remove domain"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* DNS Verification Status */}
              {domain.status !== 'verified' && (
                <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                  <h4 className="text-sm font-medium text-amber-800 mb-3">DNS Records Required</h4>
                  <p className="text-xs text-amber-700 mb-3">
                    Add these records to your domain's DNS settings, then click the refresh button to verify.
                  </p>
                  <div className="space-y-2">
                    {domain.spf_record && (
                      <DnsRow
                        type="TXT (SPF)"
                        name={domain.domain}
                        value={domain.spf_record}
                        verified={domain.spf_verified}
                        onCopy={copyToClipboard}
                      />
                    )}
                    {domain.dkim_record && (
                      <DnsRow
                        type="TXT (DKIM)"
                        name={`${domain.dkim_selector}._domainkey.${domain.domain}`}
                        value={domain.dkim_record}
                        verified={domain.dkim_verified}
                        onCopy={copyToClipboard}
                      />
                    )}
                    {domain.tracking_cname && (
                      <DnsRow
                        type="CNAME (Tracking)"
                        name={`email.${domain.domain}`}
                        value={domain.tracking_cname}
                        verified={domain.tracking_verified}
                        onCopy={copyToClipboard}
                      />
                    )}
                  </div>
                </div>
              )}

              {/* Verified confirmation */}
              {domain.status === 'verified' && (
                <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="text-sm text-green-700">
                    Domain verified and active. All emails from your organization will use this domain.
                  </span>
                </div>
              )}

              {/* Branding Settings */}
              {showBranding === domain.id && (
                <div className="mt-4 p-4 bg-slate-50 border border-slate-200 rounded-lg">
                  <h4 className="text-sm font-medium text-slate-800 mb-3">Email Branding</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Brand Color</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={brandColor}
                          onChange={e => setBrandColor(e.target.value)}
                          className="h-8 w-8 rounded border border-slate-300 cursor-pointer"
                        />
                        <input
                          type="text"
                          value={brandColor}
                          onChange={e => setBrandColor(e.target.value)}
                          className="flex-1 px-2 py-1 border border-slate-300 rounded text-xs font-mono"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Logo URL</label>
                      <input
                        type="url"
                        value={logoUrl}
                        onChange={e => setLogoUrl(e.target.value)}
                        placeholder="https://yourco.com/logo.png"
                        className="w-full px-2 py-1 border border-slate-300 rounded text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Footer Text</label>
                      <input
                        type="text"
                        value={footerText}
                        onChange={e => setFooterText(e.target.value)}
                        placeholder="© 2026 Your Company"
                        className="w-full px-2 py-1 border border-slate-300 rounded text-xs"
                      />
                    </div>
                  </div>
                  <button
                    onClick={() => handleUpdateBranding(domain.id)}
                    className="mt-3 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded hover:bg-blue-700"
                  >
                    Save Branding
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* How It Works */}
      <div className="mt-8 p-6 bg-slate-50 border border-slate-200 rounded-xl">
        <h3 className="text-sm font-semibold text-slate-800 mb-3">How Custom Domains Work</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-slate-600">
          <div>
            <span className="font-semibold text-slate-800 block mb-1">1. Add Domain</span>
            Enter your sending domain (we recommend a subdomain like mail.yourco.com to protect your main domain reputation).
          </div>
          <div>
            <span className="font-semibold text-slate-800 block mb-1">2. Configure DNS</span>
            Add SPF and DKIM records to your domain registrar. This authorizes our servers to send on your behalf.
          </div>
          <div>
            <span className="font-semibold text-slate-800 block mb-1">3. Send Branded</span>
            Once verified, all emails — RFQs, notifications, outreach — go out from your domain with your branding.
          </div>
        </div>
      </div>
    </div>
  )
}

function DnsRow({ type, name, value, verified, onCopy }: {
  type: string
  name: string
  value: string
  verified: boolean
  onCopy: (text: string) => void
}) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className={`w-3 h-3 rounded-full flex-shrink-0 ${verified ? 'bg-green-500' : 'bg-amber-400'}`} />
      <span className="font-medium text-slate-700 w-28 flex-shrink-0">{type}</span>
      <span className="font-mono text-slate-600 truncate flex-1">{name}</span>
      <button
        onClick={() => onCopy(value)}
        className="p-1 text-slate-400 hover:text-blue-600 flex-shrink-0"
        title="Copy value"
      >
        <Copy className="h-3 w-3" />
      </button>
    </div>
  )
}
