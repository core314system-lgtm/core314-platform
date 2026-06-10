import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import {
  Building, MapPin, BadgeCheck, Loader2, AlertCircle,
  CheckCircle, Mail, Lock, User, ArrowRight, Phone,
  Shield, Star, Briefcase,
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

  // Account creation form (optional - shown after confirmation)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (token) validateToken(token)
  }, [token])

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

    // If user is already logged in, auto-confirm
    if (user) {
      await confirmAndClaim(data.id, user.id)
    } else {
      setEmail(data.contact_email || '')
      setStep('preview')
    }
  }

  // One-click confirm — marks as confirmed in DB without requiring account
  async function handleConfirm() {
    if (!sub) return
    setSubmitting(true)

    // If logged in, do full claim
    if (user) {
      await confirmAndClaim(sub.id, user.id)
      return
    }

    // Not logged in — mark as "confirmed" (lighter than full claim)
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
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="max-w-md w-full bg-white rounded-xl border border-gray-200 p-8 text-center">
          <AlertCircle size={48} className="mx-auto text-red-400 mb-4" />
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Claim Link Invalid</h2>
          <p className="text-gray-500 text-sm mb-6">{error || 'This claim link is no longer valid.'}</p>
          <a href="https://procuvex.com" className="text-blue-600 hover:text-blue-800 text-sm font-medium">
            Go to Procuvex →
          </a>
        </div>
      </div>
    )
  }

  if (step === 'expired') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
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
    )
  }

  if (step === 'already_claimed') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
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
    )
  }

  // --- CONFIRMED — show success + optional account creation ---
  if (step === 'confirmed') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-lg w-full space-y-6">
          {/* Success */}
          <div className="bg-white rounded-xl border border-green-200 p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
              <CheckCircle size={32} className="text-green-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Profile Confirmed!</h2>
            <p className="text-gray-600 text-sm mb-1">
              <strong>{sub?.company_name}</strong> is now confirmed on Procuvex.
            </p>
            <p className="text-gray-500 text-sm">
              Prime contractors can now find you in search results.
            </p>
          </div>

          {/* Optional: Create account for full control */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-base font-semibold text-gray-900 mb-1">Want to manage your profile?</h3>
            <p className="text-sm text-gray-500 mb-4">
              Create a free account to edit your profile, respond to RFQs, and manage bid invitations. Optional — you'll still appear in search results without an account.
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
                    required minLength={8} placeholder="Password (min 8 characters)"
                    className="w-full pl-9 pr-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
              <button type="submit" disabled={submitting}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                {submitting ? <Loader2 size={16} className="animate-spin" /> : <Briefcase size={16} />}
                Create Account & Manage Profile
              </button>
            </form>

            <p className="text-xs text-gray-400 text-center mt-3">
              Already have an account? <a href="/login" className="text-blue-600 hover:underline">Sign in</a> then revisit this link.
            </p>
          </div>
        </div>
      </div>
    )
  }

  // --- PREVIEW + ONE-CLICK CONFIRM ---
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-lg w-full space-y-5">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Is this your company?</h1>
          <p className="text-gray-500 text-sm mt-1">Confirm your profile to start receiving bid opportunities</p>
        </div>

        {/* Company Profile Card */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
              <Building size={28} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-bold text-gray-900">{sub?.company_name}</h2>
              {(sub?.city || sub?.state) && (
                <p className="flex items-center gap-1 text-sm text-gray-500 mt-1">
                  <MapPin size={13} />
                  {[sub?.city, sub?.state].filter(Boolean).join(', ')}
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

          {/* Trade categories */}
          {sub?.trade_categories && sub.trade_categories.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-4">
              {sub.trade_categories.slice(0, 5).map(t => (
                <span key={t} className="px-2.5 py-1 bg-blue-50 text-blue-700 rounded-md text-xs font-medium">{t}</span>
              ))}
            </div>
          )}

          {/* Certifications */}
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
        </div>

        {/* Confirm Button — BIG and prominent */}
        <div className="bg-white rounded-xl border-2 border-green-200 p-6 text-center">
          <button
            onClick={handleConfirm}
            disabled={submitting}
            className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl text-lg font-bold hover:from-green-700 hover:to-emerald-700 disabled:opacity-50 shadow-lg hover:shadow-xl transition-all"
          >
            {submitting ? <Loader2 size={22} className="animate-spin" /> : <CheckCircle size={22} />}
            Yes, This Is My Company
          </button>
          <p className="text-gray-500 text-xs mt-3">One click. No account required. 100% free.</p>
        </div>

        {/* Benefits */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm font-semibold text-gray-800 mb-3">What happens when you confirm:</p>
          <div className="space-y-2.5">
            <div className="flex items-start gap-2.5">
              <Star size={16} className="text-amber-500 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-gray-600">Your profile appears first when primes search for subcontractors in your trade</p>
            </div>
            <div className="flex items-start gap-2.5">
              <Mail size={16} className="text-blue-500 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-gray-600">You'll receive RFQ invitations from prime contractors directly to your inbox</p>
            </div>
            <div className="flex items-start gap-2.5">
              <BadgeCheck size={16} className="text-green-500 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-gray-600">Confirmed profiles get a trust badge visible to all primes on the platform</p>
            </div>
          </div>
        </div>

        {/* Already signed in shortcut */}
        {user && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700 text-center">
            <CheckCircle size={14} className="inline mr-1" />
            Signed in as <strong>{profile?.email || user.email}</strong>. Confirming will also claim this profile to your account.
          </div>
        )}
      </div>
    </div>
  )
}
