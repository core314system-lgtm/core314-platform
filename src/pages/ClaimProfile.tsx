import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import {
  Building, MapPin, BadgeCheck, Loader2, AlertCircle,
  CheckCircle, Mail, Lock, User, ArrowRight, Phone,
  Shield, Star, Briefcase, Globe, Users, FileText,
  TrendingUp, Clock, Zap,
} from 'lucide-react'

interface ClaimableSub {
  id: string
  company_name: string
  slug: string
  city: string | null
  state: string | null
  contact_email: string | null
  contact_phone: string | null
  trade_categories: string[]
  small_business_types: string[]
  profile_completeness: number
  verification_status: string
  claim_token_expires_at: string | null
  description: string | null
  naics_codes: string[] | null
}

type ClaimStep = 'loading' | 'preview' | 'confirmed' | 'create-account' | 'error' | 'expired' | 'already_claimed'

export default function ClaimProfile() {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const { user, profile } = useAuth()

  const [step, setStep] = useState<ClaimStep>('loading')
  const [sub, setSub] = useState<ClaimableSub | null>(null)
  const [error, setError] = useState('')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (token) validateToken(token)
  }, [token])

  // Track real page visit via JS beacon (bots don't execute JS)
  useEffect(() => {
    if (sub?.contact_email && (step === 'preview' || step === 'confirmed')) {
      const emailParam = btoa(sub.contact_email)
      fetch(`/.netlify/functions/ses-webhook?t=page_visit&e=${emailParam}`).catch(() => {})
    }
  }, [sub?.contact_email, step])

  async function validateToken(t: string) {
    const { data, error: fetchError } = await supabase
      .from('master_subcontractors')
      .select('id, company_name, slug, city, state, contact_email, contact_phone, trade_categories, small_business_types, profile_completeness, verification_status, claim_token_expires_at, description, naics_codes')
      .eq('claim_token', t)
      .single()

    if (fetchError || !data) {
      setStep('error')
      setError('Invalid or expired claim link. This link may have already been used.')
      return
    }

    if (data.verification_status === 'claimed' || data.verification_status === 'verified') {
      setStep('already_claimed')
      setSub(data)
      return
    }

    if (data.claim_token_expires_at && new Date(data.claim_token_expires_at) < new Date()) {
      setStep('expired')
      setSub(data)
      return
    }

    setSub(data)

    if (user) {
      await confirmAndClaim(data.id, user.id)
    } else {
      setEmail(data.contact_email || '')
      setStep('preview')
    }
  }

  async function handleConfirm() {
    if (!sub) return
    setSubmitting(true)

    if (user) {
      await confirmAndClaim(sub.id, user.id)
      return
    }

    const { error: updateError } = await supabase
      .from('master_subcontractors')
      .update({
        verification_status: 'confirmed',
        confirmed_at: new Date().toISOString(),
      })
      .eq('id', sub.id)

    if (updateError) {
      setError(updateError.message)
      setStep('error')
    } else {
      setStep('confirmed')
    }
    setSubmitting(false)
  }

  async function confirmAndClaim(subId: string, userId: string) {
    const { error: updateError } = await supabase
      .from('master_subcontractors')
      .update({
        claimed_by_user_id: userId,
        claimed_at: new Date().toISOString(),
        verification_status: 'claimed',
        confirmed_at: new Date().toISOString(),
        claim_token: null,
      })
      .eq('id', subId)

    if (updateError) {
      setError(updateError.message)
      setStep('error')
    } else {
      await supabase.from('user_profiles').update({
        account_type: 'subcontractor',
        beta_agreement_accepted_at: new Date().toISOString(),
        beta_agreement_version: '2026-05',
      }).eq('id', userId)
      fetch('/.netlify/functions/sub-claim-notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sub_id: subId }),
      }).catch(() => {})
      navigate('/my-sub-profile?claimed=true')
    }
    setSubmitting(false)
  }

  async function handleCreateAccountAndClaim(e: React.FormEvent) {
    e.preventDefault()
    if (!sub) return
    setSubmitting(true)
    setError('')

    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    })

    if (signUpError) {
      setError(signUpError.message)
      setSubmitting(false)
      return
    }

    if (!signUpData.user) {
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email, password })
      if (signInError) {
        setError('Account may already exist. Try signing in first, then revisit this link.')
        setSubmitting(false)
        return
      }
      if (signInData.user) {
        await confirmAndClaim(sub.id, signInData.user.id)
        return
      }
    } else {
      await confirmAndClaim(sub.id, signUpData.user.id)
    }
  }

  // --- Branded Header ---
  const BrandHeader = () => (
    <div className="bg-white border-b border-gray-200">
      <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center">
            <span className="text-white font-bold text-sm">Px</span>
          </div>
          <div>
            <span className="font-bold text-gray-900 text-sm">Procuvex</span>
            <span className="text-gray-400 text-xs ml-1.5">by Core314 Technologies</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-gray-400">
          <Shield size={12} className="text-green-500" />
          <span>Secure & Verified</span>
        </div>
      </div>
    </div>
  )

  // --- RENDER ---

  if (step === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 size={32} className="animate-spin text-blue-500" />
      </div>
    )
  }

  if (step === 'error') {
    return (
      <div className="min-h-screen bg-gray-50">
        <BrandHeader />
        <div className="flex items-center justify-center p-4 mt-12">
          <div className="max-w-md w-full bg-white rounded-xl border border-gray-200 p-8 text-center">
            <AlertCircle size={48} className="mx-auto text-red-400 mb-4" />
            <h2 className="text-xl font-semibold text-gray-800 mb-2">Claim Link Invalid</h2>
            <p className="text-gray-500 text-sm mb-6">{error || 'This claim link is no longer valid.'}</p>
            <a href="https://procuvex.com" className="text-blue-600 hover:text-blue-800 text-sm font-medium">
              Visit Procuvex →
            </a>
          </div>
        </div>
      </div>
    )
  }

  if (step === 'expired') {
    return (
      <div className="min-h-screen bg-gray-50">
        <BrandHeader />
        <div className="flex items-center justify-center p-4 mt-12">
          <div className="max-w-md w-full bg-white rounded-xl border border-gray-200 p-8 text-center">
            <AlertCircle size={48} className="mx-auto text-amber-400 mb-4" />
            <h2 className="text-xl font-semibold text-gray-800 mb-2">Link Expired</h2>
            <p className="text-gray-500 text-sm mb-4">
              This claim link for <strong>{sub?.company_name}</strong> has expired.
            </p>
            <p className="text-gray-500 text-sm mb-6">
              Contact us at <a href="mailto:team@procuvex.com" className="text-blue-600">team@procuvex.com</a> to request a new claim link.
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (step === 'already_claimed') {
    return (
      <div className="min-h-screen bg-gray-50">
        <BrandHeader />
        <div className="flex items-center justify-center p-4 mt-12">
          <div className="max-w-md w-full bg-white rounded-xl border border-gray-200 p-8 text-center">
            <CheckCircle size={48} className="mx-auto text-green-400 mb-4" />
            <h2 className="text-xl font-semibold text-gray-800 mb-2">Already Claimed</h2>
            <p className="text-gray-500 text-sm mb-6">
              <strong>{sub?.company_name}</strong> has already been claimed. If this is your company, sign in to manage your profile.
            </p>
            <a href="https://procuvex.com/login" className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
              Sign In <ArrowRight size={14} />
            </a>
          </div>
        </div>
      </div>
    )
  }

  // --- CONFIRMED — show success + optional account creation ---
  if (step === 'confirmed') {
    return (
      <div className="min-h-screen bg-gray-50">
        <BrandHeader />
        <div className="flex items-center justify-center p-4 mt-8">
          <div className="max-w-lg w-full space-y-6">
            <div className="bg-white rounded-xl border border-green-200 p-8 text-center">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                <CheckCircle size={32} className="text-green-600" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Profile Activated!</h2>
              <p className="text-gray-600 text-sm mb-1">
                <strong>{sub?.company_name}</strong> is now active on Procuvex.
              </p>
              <p className="text-gray-500 text-sm">
                Prime contractors searching for {sub?.trade_categories?.[0] || 'your trade'} in {sub?.state || 'your area'} can now find and contact you.
              </p>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-base font-semibold text-gray-900 mb-1">Want full control of your profile?</h3>
              <p className="text-sm text-gray-500 mb-4">
                Create a free account to edit your details, upload certifications, respond to RFQs, and receive bid invitations. Takes 30 seconds.
              </p>

              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  {error}
                </div>
              )}

              <form onSubmit={handleCreateAccountAndClaim} className="space-y-3">
                <div>
                  <div className="relative">
                    <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text" value={fullName} onChange={e => setFullName(e.target.value)}
                      required placeholder="Full Name"
                      className="w-full pl-9 pr-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
                <div>
                  <div className="relative">
                    <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="email" value={email} onChange={e => setEmail(e.target.value)}
                      required placeholder="Email Address"
                      className="w-full pl-9 pr-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
                <div>
                  <div className="relative">
                    <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="password" value={password} onChange={e => setPassword(e.target.value)}
                      required minLength={8} placeholder="Create Password (min 8 characters)"
                      className="w-full pl-9 pr-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
                <button type="submit" disabled={submitting}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                  {submitting ? <Loader2 size={16} className="animate-spin" /> : <Briefcase size={16} />}
                  Create Free Account
                </button>
              </form>

              <p className="text-xs text-gray-400 text-center mt-3">
                Already have an account? <a href="/login" className="text-blue-600 hover:underline">Sign in</a> then revisit this link.
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // --- PREVIEW + ONE-CLICK CONFIRM ---
  const trades = sub?.trade_categories?.slice(0, 3) || []
  const location = [sub?.city, sub?.state].filter(Boolean).join(', ') || 'your area'

  return (
    <div className="min-h-screen bg-gray-50">
      <BrandHeader />

      <div className="max-w-2xl mx-auto px-4 py-8 space-y-5">

        {/* What is Procuvex — brief explainer */}
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <Globe size={20} className="text-blue-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm text-blue-900 font-medium">
                Procuvex is a government contracting platform where prime contractors find and hire subcontractors.
              </p>
              <p className="text-xs text-blue-700 mt-1">
                Your company was found in public federal and state databases (SAM.gov, SBA, state directories).
                We built a profile for you so primes can find you for upcoming bids. Activating is free and takes one click.
              </p>
            </div>
          </div>
        </div>

        {/* Company Profile Card */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">Your Company Profile</p>
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
              <Building size={28} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-bold text-gray-900">{sub?.company_name}</h2>
              {(sub?.city || sub?.state) && (
                <p className="flex items-center gap-1 text-sm text-gray-500 mt-1">
                  <MapPin size={13} />
                  {location}
                </p>
              )}
              {sub?.contact_phone && (
                <p className="flex items-center gap-1 text-sm text-gray-500 mt-0.5">
                  <Phone size={13} />
                  {sub.contact_phone}
                </p>
              )}
            </div>
          </div>

          {trades.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-4">
              {trades.map(t => (
                <span key={t} className="px-2.5 py-1 bg-blue-50 text-blue-700 rounded-md text-xs font-medium">{t}</span>
              ))}
            </div>
          )}

          {sub?.small_business_types && sub.small_business_types.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {sub.small_business_types.map(t => (
                <span key={t} className="px-2.5 py-1 bg-green-50 text-green-700 rounded-md text-xs font-medium flex items-center gap-1">
                  <Shield size={10} /> {t}
                </span>
              ))}
            </div>
          )}

          {sub?.description && (
            <p className="text-sm text-gray-600 mt-3 line-clamp-2">{sub.description}</p>
          )}

          <div className="mt-4 pt-3 border-t border-gray-100 flex items-center gap-1.5 text-xs text-gray-400">
            <FileText size={11} />
            <span>Data sourced from SAM.gov and public government databases</span>
          </div>
        </div>

        {/* CTA — Activate Profile */}
        <div className="bg-white rounded-xl border-2 border-green-200 p-6 text-center shadow-sm">
          <p className="text-sm font-medium text-gray-700 mb-3">Does this look right? Activate your profile so prime contractors can find you.</p>
          <button
            onClick={handleConfirm}
            disabled={submitting}
            className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl text-lg font-bold hover:from-green-700 hover:to-emerald-700 disabled:opacity-50 shadow-lg hover:shadow-xl transition-all"
          >
            {submitting ? <Loader2 size={22} className="animate-spin" /> : <Zap size={22} />}
            Activate My Free Profile
          </button>
          <div className="flex items-center justify-center gap-4 mt-3 text-xs text-gray-400">
            <span className="flex items-center gap-1"><CheckCircle size={11} className="text-green-500" /> One click</span>
            <span className="flex items-center gap-1"><Shield size={11} className="text-green-500" /> No account needed</span>
            <span className="flex items-center gap-1"><Star size={11} className="text-green-500" /> Always free</span>
          </div>
        </div>

        {/* What you get — tangible benefits */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm font-semibold text-gray-800 mb-4">What happens when you activate:</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex items-start gap-2.5 p-3 rounded-lg bg-gray-50">
              <Users size={16} className="text-blue-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-gray-800">Get found by primes</p>
                <p className="text-xs text-gray-500">Prime contractors search Procuvex to find subs for their bids</p>
              </div>
            </div>
            <div className="flex items-start gap-2.5 p-3 rounded-lg bg-gray-50">
              <Mail size={16} className="text-blue-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-gray-800">Receive RFQ invitations</p>
                <p className="text-xs text-gray-500">Get bid requests sent directly to your inbox</p>
              </div>
            </div>
            <div className="flex items-start gap-2.5 p-3 rounded-lg bg-gray-50">
              <BadgeCheck size={16} className="text-green-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-gray-800">Verified badge</p>
                <p className="text-xs text-gray-500">Active profiles rank higher and display a trust badge</p>
              </div>
            </div>
            <div className="flex items-start gap-2.5 p-3 rounded-lg bg-gray-50">
              <TrendingUp size={16} className="text-purple-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-gray-800">Track opportunities</p>
                <p className="text-xs text-gray-500">See new contracts matching your trade and location</p>
              </div>
            </div>
          </div>
        </div>

        {/* Social proof */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <div className="flex -space-x-2">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 border-2 border-white flex items-center justify-center">
                    <Building size={12} className="text-white" />
                  </div>
                ))}
              </div>
              <p className="text-sm text-gray-600">
                <strong className="text-gray-900">130,000+</strong> subcontractors on the network
              </p>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-gray-400">
              <Clock size={12} />
              <span>Takes 5 seconds to activate</span>
            </div>
          </div>
        </div>

        {/* Trust footer */}
        <div className="text-center space-y-2 pb-8">
          <div className="flex items-center justify-center gap-4 text-xs text-gray-400">
            <span className="flex items-center gap-1"><Shield size={11} /> SSL Encrypted</span>
            <span>•</span>
            <span className="flex items-center gap-1"><Lock size={11} /> We never share your data</span>
            <span>•</span>
            <span className="flex items-center gap-1"><Globe size={11} /> <a href="https://procuvex.com" className="hover:text-blue-500">procuvex.com</a></span>
          </div>
          <p className="text-xs text-gray-300">
            Procuvex is a product of Core314 Technologies LLC
          </p>
        </div>

        {user && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700 text-center">
            <CheckCircle size={14} className="inline mr-1" />
            Signed in as <strong>{profile?.email || user.email}</strong>. Activating will also claim this profile to your account.
          </div>
        )}
      </div>
    </div>
  )
}
