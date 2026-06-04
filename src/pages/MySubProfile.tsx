import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
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

export default function MySubProfile() {
  const { user } = useAuth()
  const [profile, setProfile] = useState<SubProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [noProfile, setNoProfile] = useState(false)

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
      .single()

    if (fetchErr || !data) {
      setNoProfile(true)
      setLoading(false)
      return
    }

    setProfile(data)
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Company Profile</h1>
          <p className="text-sm text-gray-500 mt-1">
            Update your profile to increase visibility and get matched with prime contractors
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link to={`/sub/${profile?.slug}`} target="_blank"
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-blue-600">
            <ExternalLink size={14} /> View Public Profile
          </Link>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Save Changes
          </button>
        </div>
      </div>

      {/* Status Bar */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <BadgeCheck size={18} className="text-blue-500" />
            <span className="text-sm font-medium text-gray-700 capitalize">{profile?.verification_status}</span>
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
