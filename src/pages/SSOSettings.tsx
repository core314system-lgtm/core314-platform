import { useState, useEffect } from 'react'
import { Shield, Plus, Trash2, Copy, CheckCircle, AlertCircle, Globe, ExternalLink } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { logAuditEvent } from '../lib/auditLog'

interface SSOProvider {
  id: string
  saml?: {
    entity_id?: string
    metadata_url?: string
  }
  domains?: { domain: string }[]
  created_at?: string
}

interface SPInfo {
  entity_id: string
  metadata_url: string
  acs_url: string
  slo_url: string
  name_id_format: string
}

export default function SSOSettings() {
  const [providers, setProviders] = useState<SSOProvider[]>([])
  const [spInfo, setSpInfo] = useState<SPInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [metadataUrl, setMetadataUrl] = useState('')
  const [domains, setDomains] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [copied, setCopied] = useState('')

  useEffect(() => {
    loadData()
  }, [])

  async function getAuthHeader() {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token ? `Bearer ${session.access_token}` : ''
  }

  async function loadData() {
    setLoading(true)
    try {
      const auth = await getAuthHeader()
      const [infoRes, listRes] = await Promise.all([
        fetch('/.netlify/functions/sso-manage', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: auth },
          body: JSON.stringify({ action: 'get-info' }),
        }),
        fetch('/.netlify/functions/sso-manage', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: auth },
          body: JSON.stringify({ action: 'list-providers' }),
        }),
      ])
      if (infoRes.ok) {
        const info = await infoRes.json()
        setSpInfo(info)
      }
      if (listRes.ok) {
        const list = await listRes.json()
        setProviders(list.providers || [])
      }
    } catch {
      setError('Failed to load SSO configuration')
    }
    setLoading(false)
  }

  async function handleAddProvider(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess('')
    setAdding(true)

    try {
      const auth = await getAuthHeader()
      const domainList = domains.split(',').map(d => d.trim().toLowerCase()).filter(Boolean)
      if (!domainList.length) {
        setError('At least one domain is required')
        setAdding(false)
        return
      }
      const res = await fetch('/.netlify/functions/sso-manage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: auth },
        body: JSON.stringify({ action: 'add-provider', metadata_url: metadataUrl, domains: domainList }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to add SSO provider')
      } else {
        setSuccess('SSO identity provider added successfully')
        setMetadataUrl('')
        setDomains('')
        logAuditEvent({ action: 'settings_changed', resourceType: 'sso_provider', metadata: { domains: domainList } })
        loadData()
      }
    } catch {
      setError('Network error')
    }
    setAdding(false)
  }

  async function handleRemoveProvider(providerId: string) {
    if (!confirm('Remove this SSO provider? Users from this domain will no longer be able to sign in with SSO.')) return
    setError('')
    setSuccess('')
    try {
      const auth = await getAuthHeader()
      const res = await fetch('/.netlify/functions/sso-manage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: auth },
        body: JSON.stringify({ action: 'remove-provider', provider_id: providerId }),
      })
      if (res.ok) {
        setSuccess('Provider removed')
        logAuditEvent({ action: 'settings_changed', resourceType: 'sso_provider', metadata: { removed: providerId } })
        loadData()
      } else {
        const data = await res.json()
        setError(data.error || 'Failed to remove provider')
      }
    } catch {
      setError('Network error')
    }
  }

  function copyToClipboard(text: string, label: string) {
    navigator.clipboard.writeText(text)
    setCopied(label)
    setTimeout(() => setCopied(''), 2000)
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Shield className="h-6 w-6 text-blue-600" />
          Single Sign-On (SSO)
        </h1>
        <p className="text-slate-500 mt-1">
          Configure SAML 2.0 SSO for your organization. Once set up, your team members can sign in using your company's identity provider (Okta, Azure AD, Google Workspace, etc.) — no passwords needed.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
          <CheckCircle className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
          <p className="text-sm text-green-700">{success}</p>
        </div>
      )}

      {/* Service Provider Info — share with customer's IT team */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Procuvex Service Provider Details</h2>
        <p className="text-sm text-slate-500 mb-4">
          Share these values with your customer's IT admin when they configure their Identity Provider (Okta, Azure AD, Google Workspace, etc.)
        </p>
        {spInfo && (
          <div className="space-y-3">
            {[
              { label: 'Entity ID (Audience URI)', value: spInfo.entity_id },
              { label: 'Metadata URL', value: spInfo.metadata_url },
              { label: 'ACS URL (Reply URL)', value: spInfo.acs_url },
              { label: 'NameID Format', value: spInfo.name_id_format },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between bg-slate-50 rounded-lg px-4 py-3">
                <div>
                  <p className="text-xs font-medium text-slate-500">{label}</p>
                  <p className="text-sm font-mono text-slate-800 break-all">{value}</p>
                </div>
                <button
                  onClick={() => copyToClipboard(value, label)}
                  className="ml-3 p-2 text-slate-400 hover:text-blue-600 transition-colors"
                  title="Copy"
                >
                  {copied === label ? <CheckCircle className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Active SSO Providers */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Active Identity Providers</h2>
        {providers.length === 0 ? (
          <p className="text-sm text-slate-400">No SSO providers configured yet. Add one below.</p>
        ) : (
          <div className="space-y-3">
            {providers.map((p) => (
              <div key={p.id} className="flex items-center justify-between bg-slate-50 rounded-lg px-4 py-3">
                <div className="flex items-center gap-3">
                  <Globe className="h-5 w-5 text-blue-500" />
                  <div>
                    <p className="text-sm font-medium text-slate-800">
                      {p.domains?.map(d => d.domain).join(', ') || 'No domains'}
                    </p>
                    <p className="text-xs text-slate-400 font-mono">
                      {p.saml?.entity_id || p.id}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => handleRemoveProvider(p.id)}
                  className="p-2 text-slate-400 hover:text-red-600 transition-colors"
                  title="Remove provider"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add New Provider */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
          <Plus className="h-5 w-5" />
          Add Identity Provider
        </h2>
        <p className="text-sm text-slate-500 mb-4">
          Enter the customer's SAML 2.0 metadata URL and the email domain(s) they use. Once added, users with those email domains can sign in via SSO on the login page.
        </p>

        <form onSubmit={handleAddProvider} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">SAML Metadata URL</label>
            <input
              type="url"
              value={metadataUrl}
              onChange={(e) => setMetadataUrl(e.target.value)}
              placeholder="https://login.microsoftonline.com/.../federationmetadata/2007-06/federationmetadata.xml"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              required
            />
            <p className="text-xs text-slate-400 mt-1">
              Get this from the customer's IT team. Supported providers: Okta, Azure AD, Google Workspace, PingIdentity, OneLogin.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email Domain(s)</label>
            <input
              type="text"
              value={domains}
              onChange={(e) => setDomains(e.target.value)}
              placeholder="company.com, subsidiary.com"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              required
            />
            <p className="text-xs text-slate-400 mt-1">
              Comma-separated. Users with these email domains will be redirected to SSO on login.
            </p>
          </div>

          <button
            type="submit"
            disabled={adding}
            className="px-6 py-2.5 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors text-sm"
          >
            {adding ? 'Adding...' : 'Add SSO Provider'}
          </button>
        </form>
      </div>

      {/* Setup Guide */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-blue-900 mb-3">How to Set Up SSO (Self-Service)</h2>
        <ol className="list-decimal list-inside space-y-3 text-sm text-blue-800">
          <li><strong>Log in to your Identity Provider</strong> (Okta, Azure AD, Google Workspace, PingIdentity, etc.)</li>
          <li><strong>Add Procuvex as a new SAML application</strong> — use the Service Provider details above (Entity ID, ACS URL, Metadata URL)</li>
          <li><strong>Copy your IdP's SAML Metadata URL</strong> — this is usually found in your IdP's app settings or SSO configuration page</li>
          <li><strong>Enter it in the form above</strong> — paste the metadata URL and your company's email domain(s)</li>
          <li><strong>Done!</strong> Your team members can now click "Sign in with SSO" on the Procuvex login page and sign in with their company credentials</li>
        </ol>
        <div className="mt-4 pt-3 border-t border-blue-200">
          <p className="text-xs text-blue-700 mb-2">
            <strong>Where to find your Metadata URL:</strong>
          </p>
          <ul className="text-xs text-blue-600 space-y-1 ml-4 list-disc">
            <li><strong>Okta:</strong> Applications → Your App → Sign On → Metadata URL</li>
            <li><strong>Azure AD:</strong> Enterprise Applications → Your App → Single sign-on → Federation Metadata XML (copy the URL)</li>
            <li><strong>Google Workspace:</strong> Admin Console → Apps → Web and mobile apps → Your App → Download metadata</li>
          </ul>
        </div>
        <div className="mt-3">
          <a
            href="https://supabase.com/docs/guides/auth/enterprise-sso/auth-sso-saml"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-blue-700 hover:text-blue-900 font-medium"
          >
            Full SAML SSO Documentation <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>
    </div>
  )
}
