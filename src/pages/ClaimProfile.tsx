import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import {
  Building, MapPin, BadgeCheck, Loader2, AlertCircle,
  CheckCircle, Mail, Lock, User, ArrowRight,
} from 'lucide-react'

interface ClaimableSub {
  id: string
  company_name: string
  slug: string
  city: string | null
  state: string | null
  contact_email: string | null
  trade_categories: string[]
  small_business_types: string[]
  profile_completeness: number
  verification_status: string
  claim_token_expires_at: string | null
}

type ClaimStep = 'loading' | 'preview' | 'signup' | 'success' | 'error' | 'expired' | 'already_claimed'

export default function ClaimProfile() {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const { user, profile } = useAuth()

  const [step, setStep] = useState<ClaimStep>('loading')
  const [sub, setSub] = useState<ClaimableSub | null>(null)
  const [error, setError] = useState('')

  // Signup form
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
      .select('id, company_name, slug, city, state, contact_email, trade_categories, small_business_types, profile_completeness, verification_status, claim_token_expires_at')
      .eq('claim_token', t)
      .single()

    if (fetchError || !data) {
      setStep('error')
      setError('Invalid or expired claim link. This link may have already been used.')
      return
    }

    // Check if already claimed
    if (data.verification_status === 'claimed' || data.verification_status === 'verified') {
      setStep('already_claimed')
      setSub(data)
      return
    }

    // Check expiration
    if (data.claim_token_expires_at && new Date(data.claim_token_expires_at) < new Date()) {
      setStep('expired')
      setSub(data)
      return
    }

    setSub(data)

    // If user is already logged in, skip to claiming directly
    if (user) {
      await claimWithExistingUser(data.id)
    } else {
      setEmail(data.contact_email || '')
      setStep('preview')
    }
  }

  async function claimWithExistingUser(subId: string) {
    const { error: updateError } = await supabase
      .from('master_subcontractors')
      .update({
        claimed_by_user_id: user!.id,
        claimed_at: new Date().toISOString(),
        verification_status: 'claimed',
        claim_token: null, // invalidate token
      })
      .eq('id', subId)

    if (updateError) {
      setError(updateError.message)
      setStep('error')
    } else {
      setStep('success')
    }
  }

  async function handleSignupAndClaim(e: React.FormEvent) {
    e.preventDefault()
    if (!sub) return
    setSubmitting(true)
    setError('')

    // Create account
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
      },
    })

    if (signUpError) {
      setError(signUpError.message)
      setSubmitting(false)
      return
    }

    // If user already exists, try to sign in
    if (!signUpData.user) {
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email, password })
      if (signInError) {
        setError('Account may already exist. Try signing in first, then revisit this claim link.')
        setSubmitting(false)
        return
      }
      if (signInData.user) {
        await claimForUser(signInData.user.id)
        return
      }
    } else {
      await claimForUser(signUpData.user.id)
    }
  }

  async function claimForUser(userId: string) {
    if (!sub) return
    const { error: updateError } = await supabase
      .from('master_subcontractors')
      .update({
        claimed_by_user_id: userId,
        claimed_at: new Date().toISOString(),
        verification_status: 'claimed',
        claim_token: null,
      })
      .eq('id', sub.id)

    if (updateError) {
      setError(updateError.message)
      setStep('error')
    } else {
      setStep('success')
    }
    setSubmitting(false)
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

  if (step === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="max-w-md w-full bg-white rounded-xl border border-gray-200 p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <CheckCircle size={32} className="text-green-600" />
          </div>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Profile Claimed!</h2>
          <p className="text-gray-500 text-sm mb-2">
            You now own the <strong>{sub?.company_name}</strong> profile on Procuvex.
          </p>
          <p className="text-gray-500 text-sm mb-6">
            Complete your profile to increase visibility and get matched with prime contractors.
          </p>
          <div className="space-y-3">
            <button
              onClick={() => navigate(`/sub/${sub?.slug}`)}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
            >
              View Your Profile <ArrowRight size={14} />
            </button>
            <button
              onClick={() => navigate('/dashboard')}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50"
            >
              Go to Dashboard
            </button>
          </div>
        </div>
      </div>
    )
  }

  // --- PREVIEW + SIGNUP/LOGIN ---
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-lg w-full space-y-6">
        {/* Company Preview Card */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
              <Building size={24} className="text-blue-600" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-semibold text-gray-900">{sub?.company_name}</h2>
              {(sub?.city || sub?.state) && (
                <p className="flex items-center gap-1 text-sm text-gray-500 mt-1">
                  <MapPin size={13} />
                  {[sub?.city, sub?.state].filter(Boolean).join(', ')}
                </p>
              )}
              {sub?.trade_categories && sub.trade_categories.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {sub.trade_categories.slice(0, 3).map(t => (
                    <span key={t} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">{t}</span>
                  ))}
                </div>
              )}
              {sub?.small_business_types && sub.small_business_types.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {sub.small_business_types.map(t => (
                    <span key={t} className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded text-xs font-medium">{t}</span>
                  ))}
                </div>
              )}
            </div>
            <div className="text-right">
              <div className="text-xs text-gray-400">Profile</div>
              <div className="text-lg font-bold text-gray-700">{sub?.profile_completeness}%</div>
            </div>
          </div>
        </div>

        {/* Claim Form */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-base font-semibold text-gray-900 mb-1">Claim This Profile</h3>
          <p className="text-sm text-gray-500 mb-5">
            Create an account or sign in to claim ownership of this company profile.
          </p>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={user ? (e) => { e.preventDefault(); claimWithExistingUser(sub!.id) } : handleSignupAndClaim} className="space-y-4">
            {!user && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                  <div className="relative">
                    <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      value={fullName}
                      onChange={e => setFullName(e.target.value)}
                      required
                      placeholder="Your name"
                      className="w-full pl-9 pr-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                  <div className="relative">
                    <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      required
                      placeholder="you@company.com"
                      className="w-full pl-9 pr-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                  <div className="relative">
                    <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="password"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required
                      minLength={8}
                      placeholder="Min 8 characters"
                      className="w-full pl-9 pr-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
              </>
            )}

            {user && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
                <CheckCircle size={14} className="inline mr-1" />
                Signed in as <strong>{profile?.email || user.email}</strong>. Click below to claim this profile.
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting ? <Loader2 size={16} className="animate-spin" /> : <BadgeCheck size={16} />}
              {user ? 'Claim Profile' : 'Create Account & Claim'}
            </button>
          </form>

          {!user && (
            <div className="mt-4 pt-4 border-t border-gray-100 text-center">
              <p className="text-sm text-gray-500">
                Already have an account?{' '}
                <button
                  onClick={() => navigate('/login')}
                  className="text-blue-600 hover:text-blue-800 font-medium"
                >
                  Sign in first
                </button>
                , then revisit this link.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
