import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { TRADE_CATEGORIES } from '../lib/naicsTradeMapping'
import {
  Building, MapPin, Save, Loader2, AlertCircle,
  CheckCircle, Globe, Phone, Mail, FileText,
  BadgeCheck, ExternalLink, Plus, X, Star,
} from 'lucide-react'

interface SubProfile {
  id: string
  company_name: string
  slug: string
  contact_name: string | null
  contact_email: string | null
  contact_phone: string | null
  website: string | null
  city: string | null
  state: string | null
  zip_code: string | null
  description: string | null
  trade_categories: string[]
  small_business: boolean
  small_business_types: string[]
  verification_status: string
  profile_completeness: number
  naics_codes: string[]
  geographic_coverage: string[]
  sam_uei: string | null
  cage_code: string | null
  capability_narrative: string | null
}

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','DC','FL','GA','HI','ID','IL','IN',
  'IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH',
  'NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT',
  'VT','VA','WA','WV','WI','WY',
]

const SB_TYPES = [
  'SDB', 'SDVOSB', 'WOSB', 'EDWOSB', 'HUBZone', '8(a)', 'VOSB', 'ANT', 'IndTrb', 'NHO', 'ANC',
]

interface Certification {
  id: string
  cert_type: string
  cert_name: string
  file_url: string | null
  expiration_date: string | null
  status: string
  uploaded_at: string
}

const DOC_TYPES = [
  { value: 'coi', label: 'Certificate of Insurance (COI)' },
  { value: 'license', label: 'Business/Trade License' },
  { value: 'w9', label: 'W-9 Form' },
  { value: 'bonding', label: 'Bonding Certificate' },
  { value: 'safety', label: 'Safety Certification (OSHA, etc.)' },
  { value: 'quality', label: 'Quality Certification (ISO, etc.)' },
  { value: 'other', label: 'Other Document' },
]

export default function MySubProfile() {
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const justClaimed = searchParams.get('claimed') === 'true'
  const justVerified = searchParams.get('verified') === 'success'
  const [showClaimedBanner, setShowClaimedBanner] = useState(justClaimed)
  const [showVerifiedBanner, setShowVerifiedBanner] = useState(justVerified)
  const [profile, setProfile] = useState<SubProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [noProfile, setNoProfile] = useState(false)
  const [certs, setCerts] = useState<Certification[]>([])
  const [showDocUpload, setShowDocUpload] = useState(false)
  const [docType, setDocType] = useState('')
  const [docName, setDocName] = useState('')
  const [docExpDate, setDocExpDate] = useState('')
  const [docUploading, setDocUploading] = useState(false)
  const [verifyLoading, setVerifyLoading] = useState(false)

  // Editable form state
  const [form, setForm] = useState({
    company_name: '',
    contact_name: '',
    contact_email: '',
    contact_phone: '',
    website: '',
    city: '',
    state: '',
    zip_code: '',
    description: '',
    capability_narrative: '',
    trade_categories: [] as string[],
    small_business: false,
    small_business_types: [] as string[],
    geographic_coverage: [] as string[],
  })

  const [newTrade, setNewTrade] = useState('')
  const [newGeo, setNewGeo] = useState('')

  useEffect(() => {
    if (user) fetchMyProfile()
  }, [user])

  async function fetchMyProfile() {
    const { data, error: fetchErr } = await supabase
      .from('master_subcontractors')
      .select('*')
      .eq('claimed_by_user_id', user!.id)
      .order('claimed_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (fetchErr || !data) {
      setNoProfile(true)
      setLoading(false)
      return
    }

    setProfile(data)

    // Fetch certifications
    const { data: certData } = await supabase
      .from('master_sub_certifications')
      .select('*')
      .eq('master_sub_id', data.id)
      .order('uploaded_at', { ascending: false })
    setCerts(certData || [])

    setForm({
      company_name: data.company_name || '',
      contact_name: data.contact_name || '',
      contact_email: data.contact_email || '',
      contact_phone: data.contact_phone || '',
      website: data.website || '',
      city: data.city || '',
      state: data.state || '',
      zip_code: data.zip_code || '',
      description: data.description || '',
      capability_narrative: data.capability_narrative || '',
      trade_categories: data.trade_categories || [],
      small_business: data.small_business || false,
      small_business_types: data.small_business_types || [],
      geographic_coverage: data.geographic_coverage || [],
    })
    setLoading(false)
  }

  function calculateCompleteness(): number {
    let score = 30 // base score for existing
    if (form.company_name) score += 5
    if (form.contact_name) score += 5
    if (form.contact_email) score += 10
    if (form.contact_phone) score += 5
    if (form.website) score += 5
    if (form.city && form.state) score += 5
    if (form.description && form.description.length > 50) score += 10
    if (form.capability_narrative && form.capability_narrative.length > 50) score += 10
    if (form.trade_categories.length > 0) score += 5
    if (form.small_business_types.length > 0) score += 5
    if (form.geographic_coverage.length > 0) score += 5
    return Math.min(score, 100)
  }

  async function handleSave() {
    if (!profile) return
    setSaving(true)
    setError('')
    setSaved(false)

    const completeness = calculateCompleteness()

    const { error: updateErr } = await supabase
      .from('master_subcontractors')
      .update({
        company_name: form.company_name,
        contact_name: form.contact_name || null,
        contact_email: form.contact_email || null,
        contact_phone: form.contact_phone || null,
        website: form.website || null,
        city: form.city || null,
        state: form.state || null,
        zip_code: form.zip_code || null,
        description: form.description || null,
        capability_narrative: form.capability_narrative || null,
        trade_categories: form.trade_categories,
        small_business: form.small_business,
        small_business_types: form.small_business_types,
        geographic_coverage: form.geographic_coverage,
        profile_completeness: completeness,
        profile_updated_at: new Date().toISOString(),
      })
      .eq('id', profile.id)

    if (updateErr) {
      setError(updateErr.message)
    } else {
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    }
    setSaving(false)
  }

  function addTrade() {
    if (newTrade && !form.trade_categories.includes(newTrade)) {
      setForm({ ...form, trade_categories: [...form.trade_categories, newTrade] })
      setNewTrade('')
    }
  }

  function removeTrade(t: string) {
    setForm({ ...form, trade_categories: form.trade_categories.filter(x => x !== t) })
  }

  function addGeo() {
    if (newGeo && !form.geographic_coverage.includes(newGeo)) {
      setForm({ ...form, geographic_coverage: [...form.geographic_coverage, newGeo] })
      setNewGeo('')
    }
  }

  function removeGeo(g: string) {
    setForm({ ...form, geographic_coverage: form.geographic_coverage.filter(x => x !== g) })
  }

  function toggleSBType(t: string) {
    const types = form.small_business_types.includes(t)
      ? form.small_business_types.filter(x => x !== t)
      : [...form.small_business_types, t]
    setForm({ ...form, small_business_types: types, small_business: types.length > 0 })
  }

  async function uploadDocument() {
    if (!profile || !docType || !docName) return
    setDocUploading(true)
    setError('')

    const res = await fetch('/.netlify/functions/sub-verification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': user!.id },
      body: JSON.stringify({
        action: 'upload-doc',
        sub_id: profile.id,
        doc_type: docType,
        doc_name: docName,
        file_url: null, // URL would come from Supabase Storage upload
        expiration_date: docExpDate || null,
      }),
    })
    const data = await res.json()
    if (data.error) {
      setError(data.error)
    } else {
      setCerts([data.certification, ...certs])
      setShowDocUpload(false)
      setDocType('')
      setDocName('')
      setDocExpDate('')
    }
    setDocUploading(false)
  }

  async function saveAndGetVerified() {
    if (!profile) return
    // Save profile first
    await handleSave()
    // Then start checkout
    setVerifyLoading(true)
    const res = await fetch('/.netlify/functions/sub-verification-checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': user!.id },
      body: JSON.stringify({
        sub_id: profile.id,
        user_id: user!.id,
        user_email: user!.email,
        plan: 'annual_intro',
      }),
    })
    const data = await res.json()
    if (data.checkout_url) {
      window.location.href = data.checkout_url
    } else {
      setError(data.error || 'Failed to start checkout')
    }
    setVerifyLoading(false)
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin" size={32} /></div>
  }

  if (noProfile) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <Building size={48} className="text-gray-400" />
        <h2 className="text-xl font-semibold text-gray-700">No Claimed Profile</h2>
        <p className="text-gray-500 text-center max-w-md">
          You haven't claimed a subcontractor profile yet. If your company is in our database,
          look for the claim email we sent or contact us to get started.
        </p>
        <Link to="/find-subs" className="text-blue-600 hover:text-blue-800 text-sm font-medium">
          Browse the Subcontractor Network →
        </Link>
      </div>
    )
  }

  const completeness = calculateCompleteness()

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Claimed Success Banner */}
      {showClaimedBanner && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CheckCircle size={24} className="text-green-600" />
            <div>
              <p className="font-semibold text-green-800">Profile Claimed Successfully!</p>
              <p className="text-sm text-green-700">Complete your profile below to increase visibility and get matched with prime contractors.</p>
            </div>
          </div>
          <button onClick={() => { setShowClaimedBanner(false); setSearchParams({}) }}
            className="text-green-600 hover:text-green-800">
            <X size={18} />
          </button>
        </div>
      )}

      {/* Verified Success Banner */}
      {showVerifiedBanner && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BadgeCheck size={24} className="text-green-600" />
            <div>
              <p className="font-semibold text-green-800">You're Procuvex Verified!</p>
              <p className="text-sm text-green-700">Your verified badge is now active. You'll appear first in prime contractor searches and receive automatic RFQ matches.</p>
            </div>
          </div>
          <button onClick={() => { setShowVerifiedBanner(false); setSearchParams({}) }}
            className="text-green-600 hover:text-green-800">
            <X size={18} />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">My Company Profile</h1>
              {profile?.verification_status === 'verified' && (
                <div className="relative group">
                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-green-500 to-emerald-600 rounded-full shadow-md">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M12 2L14.4 4.4L17.6 3.6L18.4 6.8L21.6 7.6L20.8 10.8L23.2 12.8L21.2 15.2L22 18.4L18.8 19.2L18 22.4L14.8 21.6L12 24L9.2 21.6L6 22.4L5.2 19.2L2 18.4L2.8 15.2L0.8 12.8L3.2 10.8L2.4 7.6L5.6 6.8L6.4 3.6L9.6 4.4L12 2Z" fill="white" fillOpacity="0.3"/>
                      <path d="M9 12L11 14L15 10" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <span className="text-white text-xs font-bold tracking-wide uppercase">Verified</span>
                  </div>
                  <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                    Procuvex Verified — Priority search &amp; auto-matching active
                  </div>
                </div>
              )}
            </div>
            <p className="text-sm text-gray-500 mt-1">
              Update your profile to increase visibility and get matched with prime contractors
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link to={`/sub/${profile?.slug}`} target="_blank"
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-blue-600">
            <ExternalLink size={14} /> View Public Profile
          </Link>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {saved ? 'Saved!' : 'Save Profile'}
          </button>
          {profile?.verification_status !== 'verified' && (
            <button onClick={saveAndGetVerified} disabled={saving || verifyLoading}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg text-sm font-medium hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 shadow-sm">
              {verifyLoading ? <Loader2 size={14} className="animate-spin" /> : <BadgeCheck size={14} />}
              Save & Get Verified
            </button>
          )}
        </div>
      </div>

      {/* Status Bar */}
      {profile?.verification_status === 'verified' && (
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
              <BadgeCheck size={22} className="text-green-600" />
            </div>
            <div>
              <p className="font-semibold text-green-800 text-sm">Procuvex Verified</p>
              <p className="text-xs text-green-600">Your profile has priority placement in search results and auto-matching with prime contractors.</p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold">
            <CheckCircle size={12} /> Active
          </span>
        </div>
      )}
      <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <BadgeCheck size={18} className={profile?.verification_status === 'verified' ? 'text-green-500' : 'text-blue-500'} />
            <span className="text-sm font-medium text-gray-700 capitalize">{profile?.verification_status === 'verified' ? 'Verified' : profile?.verification_status}</span>
          </div>
          {profile?.sam_uei && (
            <span className="text-xs text-gray-400">UEI: {profile.sam_uei}</span>
          )}
          {profile?.cage_code && (
            <span className="text-xs text-gray-400">CAGE: {profile.cage_code}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Star size={14} className="text-amber-500" />
          <span className="text-sm font-medium text-gray-700">{completeness}% complete</span>
          <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${completeness}%` }} />
          </div>
        </div>
      </div>

      {saved && (
        <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
          <CheckCircle size={14} /> Profile saved successfully
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <AlertCircle size={14} /> {error}
        </div>
      )}

      {/* Company Info */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h2 className="font-semibold text-gray-900 flex items-center gap-2"><Building size={16} /> Company Information</h2>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Company Name *</label>
            <input type="text" value={form.company_name} onChange={e => setForm({ ...form, company_name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Website</label>
            <div className="relative">
              <Globe size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="url" value={form.website} onChange={e => setForm({ ...form, website: e.target.value })}
                placeholder="https://yourcompany.com"
                className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
            </div>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Company Description</label>
          <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
            rows={3} placeholder="Brief description of your company and services..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Capability Narrative</label>
          <textarea value={form.capability_narrative} onChange={e => setForm({ ...form, capability_narrative: e.target.value })}
            rows={3} placeholder="Detailed capabilities, past performance, key differentiators..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
        </div>
      </div>

      {/* Contact Info */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h2 className="font-semibold text-gray-900 flex items-center gap-2"><Mail size={16} /> Contact Information</h2>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Contact Name</label>
            <input type="text" value={form.contact_name} onChange={e => setForm({ ...form, contact_name: e.target.value })}
              placeholder="Primary contact"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
            <input type="email" value={form.contact_email} onChange={e => setForm({ ...form, contact_email: e.target.value })}
              placeholder="contact@company.com"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Phone</label>
            <div className="relative">
              <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="tel" value={form.contact_phone} onChange={e => setForm({ ...form, contact_phone: e.target.value })}
                placeholder="(555) 123-4567"
                className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
            </div>
          </div>
        </div>
      </div>

      {/* Location */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h2 className="font-semibold text-gray-900 flex items-center gap-2"><MapPin size={16} /> Location</h2>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">City</label>
            <input type="text" value={form.city} onChange={e => setForm({ ...form, city: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">State</label>
            <select value={form.state} onChange={e => setForm({ ...form, state: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
              <option value="">Select state</option>
              {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">ZIP Code</label>
            <input type="text" value={form.zip_code} onChange={e => setForm({ ...form, zip_code: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
          </div>
        </div>

        {/* Geographic Coverage */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Geographic Coverage</label>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {form.geographic_coverage.map(g => (
              <span key={g} className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs">
                {g} <button onClick={() => removeGeo(g)} className="hover:text-red-500"><X size={10} /></button>
              </span>
            ))}
          </div>
          {!form.geographic_coverage.includes('Nationwide') && (
            <button
              onClick={() => setForm({ ...form, geographic_coverage: ['Nationwide'] })}
              className="mb-2 px-3 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-xs font-medium hover:bg-blue-100">
              + Nationwide Coverage
            </button>
          )}
          <div className="flex gap-2">
            <select value={newGeo} onChange={e => setNewGeo(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm">
              <option value="">Add state coverage...</option>
              {US_STATES.filter(s => !form.geographic_coverage.includes(s)).map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <button onClick={addGeo} disabled={!newGeo}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50">
              <Plus size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Trade Categories */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h2 className="font-semibold text-gray-900 flex items-center gap-2"><FileText size={16} /> Trade Categories</h2>

        <div className="flex flex-wrap gap-1.5 mb-2">
          {form.trade_categories.map(t => (
            <span key={t} className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-medium">
              {t} <button onClick={() => removeTrade(t)} className="hover:text-red-500"><X size={10} /></button>
            </span>
          ))}
          {form.trade_categories.length === 0 && <span className="text-xs text-gray-400">No trades selected</span>}
        </div>

        <div className="flex gap-2">
          <select value={newTrade} onChange={e => setNewTrade(e.target.value)}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm">
            <option value="">Add trade category...</option>
            {TRADE_CATEGORIES.filter(t => !form.trade_categories.includes(t.name)).map(t => (
              <option key={t.id} value={t.name}>{t.name}</option>
            ))}
          </select>
          <button onClick={addTrade} disabled={!newTrade}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50">
            <Plus size={14} />
          </button>
        </div>
      </div>

      {/* Small Business Certifications */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h2 className="font-semibold text-gray-900 flex items-center gap-2"><BadgeCheck size={16} /> Small Business Certifications</h2>
        <p className="text-xs text-gray-500">Select all certifications that apply to your company.</p>

        <div className="grid grid-cols-4 gap-2">
          {SB_TYPES.map(type => (
            <button key={type} onClick={() => toggleSBType(type)}
              className={`px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${
                form.small_business_types.includes(type)
                  ? 'bg-blue-50 border-blue-300 text-blue-700'
                  : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}>
              {type}
            </button>
          ))}
        </div>
      </div>

      {/* Verification Upgrade CTA — Prime Position */}
      {profile?.verification_status !== 'verified' && (
        <div className="relative overflow-hidden bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 rounded-xl p-6 text-white shadow-lg">
          <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />
          <div className="relative">
            <div className="flex items-center gap-2 mb-1">
              <BadgeCheck size={20} className="text-yellow-300" />
              <span className="text-xs font-semibold bg-yellow-400 text-yellow-900 px-2 py-0.5 rounded-full uppercase tracking-wide">Limited Introductory Pricing</span>
            </div>
            <h2 className="text-xl font-bold mt-2">Get Procuvex Verified — $99/year</h2>
            <p className="text-blue-100 text-sm mt-1 mb-4 max-w-xl">
              Prime contractors search for verified subcontractors first. Without verification, your profile won't appear in priority searches.
            </p>

            <div className="grid grid-cols-2 gap-3 mb-5">
              <div className="flex items-start gap-2">
                <CheckCircle size={16} className="text-green-300 mt-0.5 flex-shrink-0" />
                <span className="text-sm text-blue-50"><strong>Verified badge</strong> — stand out from unverified competitors</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle size={16} className="text-green-300 mt-0.5 flex-shrink-0" />
                <span className="text-sm text-blue-50"><strong>Priority placement</strong> — appear first in search results</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle size={16} className="text-green-300 mt-0.5 flex-shrink-0" />
                <span className="text-sm text-blue-50"><strong>Auto-matching</strong> — get matched to RFQs in your trades automatically</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle size={16} className="text-green-300 mt-0.5 flex-shrink-0" />
                <span className="text-sm text-blue-50"><strong>Expiration alerts</strong> — never miss a certification renewal</span>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <button onClick={saveAndGetVerified} disabled={verifyLoading || saving}
                className="flex items-center gap-2 px-6 py-3 bg-white text-blue-700 rounded-lg text-sm font-bold hover:bg-blue-50 disabled:opacity-60 shadow-md transition">
                {verifyLoading ? <Loader2 size={14} className="animate-spin" /> : <BadgeCheck size={14} />}
                Save & Get Verified — $99/year
              </button>
              <span className="text-xs text-blue-200">Introductory price — will increase. Lock in $99/yr today.</span>
            </div>
          </div>
        </div>
      )}

      {/* Verification & Documents */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <BadgeCheck size={16} /> Verification & Documents
          </h2>
          {profile?.verification_status === 'verified' && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
              <CheckCircle size={12} /> Verified
            </span>
          )}
        </div>

        {/* Uploaded Documents */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Documents ({certs.length})</span>
            <button onClick={() => setShowDocUpload(!showDocUpload)}
              className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium">
              <Plus size={12} /> Add Document
            </button>
          </div>

          {showDocUpload && (
            <div className="border border-gray-200 rounded-lg p-4 mb-3 space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Document Type</label>
                  <select value={docType} onChange={e => setDocType(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs">
                    <option value="">Select type...</option>
                    {DOC_TYPES.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Document Name</label>
                  <input type="text" value={docName} onChange={e => setDocName(e.target.value)}
                    placeholder="e.g. General Liability COI"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Expiration Date</label>
                  <input type="date" value={docExpDate} onChange={e => setDocExpDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs" />
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={uploadDocument} disabled={docUploading || !docType || !docName}
                  className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700 disabled:opacity-50">
                  {docUploading ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                  Add
                </button>
                <button onClick={() => setShowDocUpload(false)}
                  className="px-3 py-1.5 border border-gray-300 rounded text-xs hover:bg-gray-50">
                  Cancel
                </button>
              </div>
            </div>
          )}

          {certs.length === 0 ? (
            <p className="text-xs text-gray-400 italic">No documents uploaded yet. Add COI, licenses, or certifications to get verified.</p>
          ) : (
            <div className="space-y-2">
              {certs.map(cert => (
                <div key={cert.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-gray-700">{cert.cert_name}</p>
                    <p className="text-xs text-gray-500">
                      {DOC_TYPES.find(d => d.value === cert.cert_type)?.label || cert.cert_type}
                      {cert.expiration_date && <> · Expires: {new Date(cert.expiration_date).toLocaleDateString()}</>}
                    </p>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                    cert.status === 'verified' ? 'bg-green-100 text-green-700' :
                    cert.status === 'pending_review' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-gray-100 text-gray-600'
                  }`}>
                    {cert.status === 'verified' ? 'Verified' : cert.status === 'pending_review' ? 'Pending' : cert.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Save button (bottom) */}
      <div className="flex justify-end pb-8">
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50">
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          Save Changes
        </button>
      </div>
    </div>
  )
}
