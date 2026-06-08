import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import {
  Building, MapPin, Loader2, AlertCircle, BadgeCheck,
  Mail, Lock, User, Phone, Wrench, ArrowRight,
} from 'lucide-react'

const stateOptions = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY','DC',
]

export default function CreateSubProfile() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const [step, setStep] = useState<'form' | 'signup' | 'creating'>(user ? 'form' : 'signup')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Signup fields
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')

  // Profile fields
  const [companyName, setCompanyName] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [phone, setPhone] = useState('')
  const [contactEmail, setContactEmail] = useState(user?.email || '')
  const [trades, setTrades] = useState('')

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError('')

    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    })

    if (signUpError) {
      // Try sign in
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
      if (signInError) {
        setError('Account may already exist. Try signing in at /login first.')
        setSubmitting(false)
        return
      }
    }

    setContactEmail(email)
    setStep('form')
    setSubmitting(false)
  }

  async function handleCreateProfile(e: React.FormEvent) {
    e.preventDefault()
    if (!companyName.trim() || !city.trim() || !state) {
      setError('Company name, city, and state are required.')
      return
    }
    setSubmitting(true)
    setError('')
    setStep('creating')

    // Get current user
    const { data: { user: currentUser } } = await supabase.auth.getUser()
    if (!currentUser) {
      setError('Please sign in first.')
      setStep('form')
      setSubmitting(false)
      return
    }

    const slug = companyName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
    const tradeList = trades.split(',').map(t => t.trim()).filter(Boolean)

    const { error: insertError } = await supabase
      .from('master_subcontractors')
      .insert({
        company_name: companyName.trim(),
        city: city.trim(),
        state: state,
        contact_email: contactEmail || currentUser.email,
        contact_phone: phone || null,
        trade_categories: tradeList.length > 0 ? tradeList : null,
        slug: slug + '-' + Date.now(),
        claimed_by_user_id: currentUser.id,
        claimed_at: new Date().toISOString(),
        verification_status: 'claimed',
        source: 'self_registration',
        profile_completeness: 20,
      })

    if (insertError) {
      setError(insertError.message)
      setStep('form')
      setSubmitting(false)
      return
    }

    // Auto-accept beta agreement so subcontractors skip that gate
    await supabase.from('user_profiles').update({
      beta_agreement_accepted_at: new Date().toISOString(),
      beta_agreement_version: '2026-05',
    }).eq('id', currentUser.id)

    navigate('/my-sub-profile?claimed=true')
  }

  if (step === 'signup') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-12">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border p-8">
          <div className="text-center mb-6">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-3">
              <Building size={32} className="text-green-600" />
            </div>
            <h1 className="text-xl font-bold text-gray-900">Create Your Profile</h1>
            <p className="text-sm text-gray-600 mt-2">First, create an account to manage your subcontractor profile.</p>
          </div>

          <form onSubmit={handleSignup} className="space-y-3">
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input
                type="text"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                placeholder="Full Name"
                required
                className="w-full pl-10 pr-4 py-3 border rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
              />
            </div>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="Email Address"
                required
                className="w-full pl-10 pr-4 py-3 border rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
              />
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Create Password"
                required
                minLength={6}
                className="w-full pl-10 pr-4 py-3 border rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
              />
            </div>
            {error && (
              <p className="text-sm text-red-600 flex items-center gap-1">
                <AlertCircle size={14} /> {error}
              </p>
            )}
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg font-semibold hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {submitting ? <Loader2 size={18} className="animate-spin" /> : <ArrowRight size={18} />}
              Continue
            </button>
          </form>
          <p className="text-center text-sm text-gray-500 mt-4">
            Already have an account? <a href="/login" className="text-blue-600 font-medium hover:underline">Sign in</a>
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-12">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border p-8">
        <div className="text-center mb-6">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-3">
            <BadgeCheck size={32} className="text-green-600" />
          </div>
          <h1 className="text-xl font-bold text-gray-900">Company Information</h1>
          <p className="text-sm text-gray-600 mt-2">Tell us about your company. You can add more details later.</p>
        </div>

        <form onSubmit={handleCreateProfile} className="space-y-3">
          <div className="relative">
            <Building className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              value={companyName}
              onChange={e => setCompanyName(e.target.value)}
              placeholder="Company Name *"
              required
              className="w-full pl-10 pr-4 py-3 border rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input
                type="text"
                value={city}
                onChange={e => setCity(e.target.value)}
                placeholder="City *"
                required
                className="w-full pl-10 pr-4 py-3 border rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
              />
            </div>
            <select
              value={state}
              onChange={e => setState(e.target.value)}
              required
              className="px-4 py-3 border rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none text-gray-700"
            >
              <option value="">State *</option>
              {stateOptions.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="Phone (optional)"
              className="w-full pl-10 pr-4 py-3 border rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
            />
          </div>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="email"
              value={contactEmail}
              onChange={e => setContactEmail(e.target.value)}
              placeholder="Contact Email"
              className="w-full pl-10 pr-4 py-3 border rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
            />
          </div>
          <div className="relative">
            <Wrench className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              value={trades}
              onChange={e => setTrades(e.target.value)}
              placeholder="Trades (comma-separated, e.g. Electrical, HVAC)"
              className="w-full pl-10 pr-4 py-3 border rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
            />
          </div>
          {error && (
            <p className="text-sm text-red-600 flex items-center gap-1">
              <AlertCircle size={14} /> {error}
            </p>
          )}
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg font-semibold hover:from-green-700 hover:to-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {submitting ? <Loader2 size={18} className="animate-spin" /> : <BadgeCheck size={18} />}
            Create My Profile
          </button>
        </form>
      </div>
    </div>
  )
}
