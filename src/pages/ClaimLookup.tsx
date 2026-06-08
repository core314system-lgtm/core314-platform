import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import {
  Building, MapPin, BadgeCheck, Loader2, AlertCircle,
  CheckCircle, Mail, Lock, User, ArrowRight,
} from 'lucide-react'

type Step = 'loading' | 'verify' | 'signup' | 'success' | 'error' | 'already_claimed'

export default function ClaimLookup() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [step, setStep] = useState<Step>('loading')
  const [sub, setSub] = useState<any>(null)
  const [error, setError] = useState('')

  // Signup form
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (id) loadSub(id)
  }, [id])

  async function loadSub(subId: string) {
    const { data, error: fetchError } = await supabase
      .from('master_subcontractors')
      .select('id, company_name, city, state, contact_email, trade_categories, verification_status')
      .eq('id', subId)
      .single()

    if (fetchError || !data) {
      setStep('error')
      setError('Company not found.')
      return
    }

    if (data.verification_status === 'claimed' || data.verification_status === 'verified') {
      setSub(data)
      setStep('already_claimed')
      return
    }

    setSub(data)

    if (user) {
      // Already logged in — show verification step
      setStep('verify')
    } else {
      setEmail(data.contact_email || '')
      setStep('signup')
    }
  }

  async function claimWithUser(userId: string) {
    if (!sub) return
    const { error: updateError } = await supabase
      .from('master_subcontractors')
      .update({
        claimed_by_user_id: userId,
        claimed_at: new Date().toISOString(),
        verification_status: 'claimed',
      })
      .eq('id', sub.id)

    if (updateError) {
      setError(updateError.message)
      setStep('error')
    } else {
      // Auto-accept beta agreement so subcontractors skip that gate
      await supabase.from('user_profiles').update({
        beta_agreement_accepted_at: new Date().toISOString(),
        beta_agreement_version: '2026-05',
      }).eq('id', userId)
      navigate('/my-sub-profile?claimed=true')
    }
  }

  async function handleClaim() {
    if (!user) return
    setSubmitting(true)
    await claimWithUser(user.id)
    setSubmitting(false)
  }

  async function handleSignupAndClaim(e: React.FormEvent) {
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
      // Try sign in if account exists
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email, password })
      if (signInError) {
        setError('Account may already exist with a different password. Try signing in at /login first.')
        setSubmitting(false)
        return
      }
      if (signInData.user) {
        await claimWithUser(signInData.user.id)
        return
      }
    }

    if (signUpData?.user) {
      await claimWithUser(signUpData.user.id)
    }
    setSubmitting(false)
  }

  if (step === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="animate-spin text-blue-600" size={32} />
      </div>
    )
  }

  if (step === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border p-8 text-center">
          <AlertCircle size={48} className="text-red-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-900 mb-2">Something went wrong</h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <a href="/for-subcontractors" className="text-blue-600 font-medium hover:underline">← Back to search</a>
        </div>
      </div>
    )
  }

  if (step === 'already_claimed') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border p-8 text-center">
          <CheckCircle size={48} className="text-green-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-900 mb-2">Profile Already Claimed</h1>
          <p className="text-gray-600 mb-6">
            <strong>{sub?.company_name}</strong> has already been claimed. If this is your company, sign in to access your profile.
          </p>
          <a href="/login" className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700">
            Sign In <ArrowRight size={16} />
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-12">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border p-8">
        {/* Company Preview */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-3">
            <Building size={32} className="text-blue-600" />
          </div>
          <h1 className="text-xl font-bold text-gray-900">{sub?.company_name}</h1>
          {sub?.city && (
            <p className="text-sm text-gray-500 flex items-center justify-center gap-1 mt-1">
              <MapPin size={14} /> {sub.city}, {sub.state}
            </p>
          )}
          {sub?.trade_categories?.[0] && (
            <span className="inline-block mt-2 px-3 py-1 bg-blue-50 text-blue-700 text-xs font-medium rounded-full">
              {sub.trade_categories[0]}
            </span>
          )}
        </div>

        <div className="border-t border-gray-100 pt-6">
          {step === 'verify' && user ? (
            <>
              <p className="text-gray-600 text-sm text-center mb-6">
                You're signed in. Click below to claim this profile as yours.
              </p>
              <button
                onClick={handleClaim}
                disabled={submitting}
                className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg font-semibold hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {submitting ? <Loader2 size={18} className="animate-spin" /> : <BadgeCheck size={18} />}
                Claim This Profile
              </button>
            </>
          ) : (
            <>
              <p className="text-gray-600 text-sm text-center mb-4">
                Create an account or sign in to claim this profile.
              </p>
              <form onSubmit={handleSignupAndClaim} className="space-y-3">
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
                  {submitting ? <Loader2 size={18} className="animate-spin" /> : <BadgeCheck size={18} />}
                  Create Account & Claim Profile
                </button>
              </form>
              <p className="text-center text-sm text-gray-500 mt-4">
                Already have an account? <a href="/login" className="text-blue-600 font-medium hover:underline">Sign in</a>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
