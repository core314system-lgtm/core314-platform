import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { LogIn, UserPlus, Mail, CheckCircle, ShieldAlert, Send, Building, User, KeyRound } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { logAuditEvent } from '../lib/auditLog'
import MfaVerify from './MfaVerify'

interface InviteInfo {
  org_name: string
  email: string
  role: string
  token: string
}

interface BetaInviteInfo {
  email: string
  token: string
}

function BetaRequestForm({ onSwitchToSignIn }: { onSwitchToSignIn: () => void }) {
  const [reqName, setReqName] = useState('')
  const [reqEmail, setReqEmail] = useState('')
  const [reqCompany, setReqCompany] = useState('')
  const [reqReason, setReqReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [reqError, setReqError] = useState('')

  async function handleRequestSubmit(e: React.FormEvent) {
    e.preventDefault()
    setReqError('')
    setSubmitting(true)

    try {
      const res = await fetch('/.netlify/functions/manage-beta-invites', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: 'request',
          action: 'request_access',
          email: reqEmail.trim(),
          name: reqName.trim(),
          company: reqCompany.trim() || undefined,
          reason: reqReason.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setReqError(data.error || 'Failed to submit request')
      } else {
        setSubmitted(true)
      }
    } catch {
      setReqError('Network error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="text-center py-4">
        <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="h-7 w-7 text-green-600" />
        </div>
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Request Submitted</h2>
        <p className="text-sm text-gray-600 mb-4">
          Thank you for your interest in Procuvex! We'll review your request and reach out to <strong>{reqEmail}</strong> if you're selected for the beta program.
        </p>
        <p className="text-xs text-gray-400">
          Already have an account? <button onClick={onSwitchToSignIn} className="text-blue-600 font-medium hover:underline">Sign In</button>
        </p>
      </div>
    )
  }

  return (
    <div>
      <div className="text-center mb-4">
        <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-3">
          <ShieldAlert className="h-6 w-6 text-blue-600" />
        </div>
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Beta Access</h2>
        <p className="text-sm text-gray-600">
          Procuvex is currently in beta. Submit your information below to request access.
        </p>
      </div>

      <form onSubmit={handleRequestSubmit} className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
          <div className="relative">
            <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={reqName}
              onChange={(e) => setReqName(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              placeholder="John Smith"
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Work Email *</label>
          <div className="relative">
            <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="email"
              value={reqEmail}
              onChange={(e) => setReqEmail(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              placeholder="john@company.com"
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
          <div className="relative">
            <Building size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={reqCompany}
              onChange={(e) => setReqCompany(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              placeholder="Acme Federal Solutions"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Why are you interested in Procuvex?</label>
          <textarea
            value={reqReason}
            onChange={(e) => setReqReason(e.target.value)}
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm resize-none"
            placeholder="e.g., We manage 20+ subcontractors across federal contracts..."
          />
        </div>

        {reqError && (
          <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">{reqError}</div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full py-2.5 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-50 bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700"
        >
          {submitting ? 'Submitting...' : <><Send size={16} /> Request Beta Access</>}
        </button>
      </form>

      <p className="text-xs text-gray-400 text-center mt-4">
        Already have an account? <button onClick={onSwitchToSignIn} className="text-blue-600 font-medium hover:underline">Sign In</button>
      </p>
    </div>
  )
}

export default function Login() {
  const [searchParams] = useSearchParams()
  const inviteToken = searchParams.get('invite')
  const betaInviteToken = searchParams.get('beta_invite')
  const fromPricing = searchParams.get('from') === 'pricing' || document.referrer.includes('/pricing')
  const selectedPlan = searchParams.get('plan') // 'growth' or 'enterprise'
  const selectedBilling = searchParams.get('billing') || 'monthly' // 'monthly' or 'annual'

  const [isSignUp, setIsSignUp] = useState(!!inviteToken || !!betaInviteToken || fromPricing)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [signUpSuccess, setSignUpSuccess] = useState(false)
  const [inviteInfo, setInviteInfo] = useState<InviteInfo | null>(null)
  const [betaInviteInfo, setBetaInviteInfo] = useState<BetaInviteInfo | null>(null)
  const [betaInviteError, setBetaInviteError] = useState<string | null>(null)
  const [betaValidating, setBetaValidating] = useState(!!betaInviteToken)
  const [showMfa, setShowMfa] = useState(false)
  const [showSso, setShowSso] = useState(false)
  const [ssoEmail, setSsoEmail] = useState('')
  const [ssoLoading, setSsoLoading] = useState(false)
  const [ssoError, setSsoError] = useState('')
  const { signIn, signUp } = useAuth()
  const navigate = useNavigate()

  // If visiting with an invite token while already logged in, sign out first
  // so the invited user can create their own account cleanly
  useEffect(() => {
    if (inviteToken) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
          supabase.auth.signOut().then(() => {
            loadInviteInfo(inviteToken)
          })
        } else {
          loadInviteInfo(inviteToken)
        }
      })
    }
  }, [inviteToken])

  // Validate beta invite token
  useEffect(() => {
    if (betaInviteToken) {
      setBetaValidating(true)
      fetch('/.netlify/functions/manage-beta-invites', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: betaInviteToken, action: 'validate' }),
      })
        .then(res => res.json())
        .then(data => {
          if (data.valid) {
            setBetaInviteInfo({ email: data.email, token: betaInviteToken })
            setEmail(data.email)
          } else {
            setBetaInviteError(data.error || 'Invalid invitation')
          }
        })
        .catch(() => setBetaInviteError('Failed to validate invitation'))
        .finally(() => setBetaValidating(false))
    }
  }, [betaInviteToken])

  async function loadInviteInfo(token: string) {
    const { data } = await supabase
      .from('org_invitations')
      .select('email, role, token, organizations(name)')
      .eq('token', token)
      .eq('status', 'pending')
      .single()

    if (data) {
      const orgName = (data.organizations as unknown as { name: string })?.name || 'an organization'
      setInviteInfo({ org_name: orgName, email: data.email, role: data.role, token })
      setEmail(data.email)
    } else {
      // Try without join if PostgREST relationship not detected
      const { data: rawInvite } = await supabase
        .from('org_invitations')
        .select('email, role, token, org_id')
        .eq('token', token)
        .eq('status', 'pending')
        .single()

      if (rawInvite) {
        const { data: org } = await supabase
          .from('organizations')
          .select('name')
          .eq('id', rawInvite.org_id)
          .single()

        setInviteInfo({
          org_name: org?.name || 'an organization',
          email: rawInvite.email,
          role: rawInvite.role,
          token,
        })
        setEmail(rawInvite.email)
      }
    }
  }

  async function acceptInvite(userId: string) {
    if (!inviteToken) return

    // Look up the invitation (may already be accepted by the DB trigger)
    const { data: invite } = await supabase
      .from('org_invitations')
      .select('id, org_id, role, email, status')
      .eq('token', inviteToken)
      .single()

    if (!invite) return

    // If already accepted by the ensure_user_org trigger, just ensure current_org is set
    if (invite.status === 'accepted') {
      await supabase.from('user_profiles').update({ current_org_id: invite.org_id }).eq('id', userId)
      return
    }

    // Check if already a member (trigger may have handled it)
    const { data: existingMember } = await supabase
      .from('organization_members')
      .select('id')
      .eq('org_id', invite.org_id)
      .eq('user_id', userId)
      .maybeSingle()

    if (!existingMember) {
      await supabase.from('organization_members').insert({
        org_id: invite.org_id,
        user_id: userId,
        role: invite.role,
        invited_by: null,
      })
    }

    // Set as current org
    await supabase.from('user_profiles').update({ current_org_id: invite.org_id }).eq('id', userId)

    // Mark invitation as accepted
    await supabase
      .from('org_invitations')
      .update({ status: 'accepted', accepted_at: new Date().toISOString() })
      .eq('id', invite.id)
  }

  async function redirectToStripeCheckout(userEmail: string, orgId: string) {
    const planId = `${selectedPlan || 'growth'}_${selectedBilling}`

    // Check for referral code from localStorage
    let referralCode: string | undefined
    try {
      const stored = localStorage.getItem('procuvex_referral')
      if (stored) {
        const ref = JSON.parse(stored)
        if (ref.expires > Date.now()) referralCode = ref.code
      }
    } catch { /* ignore */ }

    const res = await fetch('/.netlify/functions/create-checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        plan_id: planId,
        org_id: orgId,
        user_email: userEmail,
        success_url: `${window.location.origin}/dashboard?subscription=success`,
        cancel_url: `${window.location.origin}/dashboard?subscription=cancelled`,
        ...(referralCode ? { referral_code: referralCode } : {}),
      }),
    })
    const data = await res.json()
    if (data.checkout_url) {
      window.location.href = data.checkout_url
    } else {
      setError(data.error || 'Failed to create checkout session')
      setLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    if (isSignUp) {
      const { error: signUpError } = await signUp(email, password, fullName)
      if (signUpError) {
        setError(signUpError.message)
        setLoading(false)
        return
      }

      // Account created successfully — claim beta invite token if present
      if (betaInviteInfo) {
        try {
          await fetch('/.netlify/functions/manage-beta-invites', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: betaInviteInfo.token, action: 'claim' }),
          })
        } catch { /* best effort */ }
      }

      if (inviteToken) {
        // For invite flows, check if session exists to accept invite
        const { data: { session: newSession } } = await supabase.auth.getSession()
        if (newSession) {
          const { data: { user: newUser } } = await supabase.auth.getUser()
          if (newUser) await acceptInvite(newUser.id)
        }
        navigate('/dashboard')
      } else if (selectedPlan) {
        // Redirect to Stripe Checkout immediately — no session needed
        // Stripe just needs the email to create/find the customer
        await redirectToStripeCheckout(email, '')
      } else {
        // No plan selected — check if session exists to go to dashboard
        const { data: { session: newSession } } = await supabase.auth.getSession()
        if (newSession) {
          navigate('/dashboard')
        } else {
          setSignUpSuccess(true)
          setLoading(false)
        }
      }
    } else {
      const { error: signInError } = await signIn(email, password)
      if (signInError) {
        setError(signInError.message)
        setLoading(false)
        return
      }
      // Check if user has MFA enrolled — if so, require verification before proceeding
      const { data: factors } = await supabase.auth.mfa.listFactors()
      if (factors?.totp?.some(f => f.status === 'verified')) {
        setShowMfa(true)
        setLoading(false)
        return
      }
      logAuditEvent({ action: 'login', metadata: { method: 'password' } })
      // If existing user signs in via invite link, accept the invite
      if (inviteToken) {
        const { data: { user: existingUser } } = await supabase.auth.getUser()
        if (existingUser) {
          await acceptInvite(existingUser.id)
        }
      }
      // If user signed in from pricing with a plan selected, redirect to Stripe
      if (selectedPlan) {
        const { data: { user: existingUser } } = await supabase.auth.getUser()
        const profile = existingUser ? await supabase
          .from('user_profiles')
          .select('current_org_id')
          .eq('id', existingUser.id)
          .single() : null
        const orgId = profile?.data?.current_org_id || ''
        await redirectToStripeCheckout(email, orgId)
      } else {
        navigate('/dashboard')
      }
    }
  }

  // Show MFA verification screen after successful password login
  if (showMfa) {
    return <MfaVerify onVerified={() => { logAuditEvent({ action: 'login', metadata: { method: 'password+mfa' } }); navigate('/dashboard') }} />
  }

  // Show success screen after signup when email confirmation is required
  if (signUpSuccess) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-xl shadow-lg p-8 text-center">
            <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Check Your Email</h1>
            <p className="text-gray-600 mb-4">
              We sent a confirmation link to <strong>{email}</strong>
            </p>
            <p className="text-sm text-gray-500 mb-6">
              Click the link in the email to activate your account and start your 7-day free trial. The link expires in 24 hours.
            </p>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <p className="text-sm text-blue-800">
                Don't see it? Check your spam folder or{' '}
                <button
                  onClick={() => setSignUpSuccess(false)}
                  className="text-blue-600 font-semibold hover:underline"
                >
                  try again with a different email
                </button>
              </p>
            </div>
            <button
              onClick={() => { setSignUpSuccess(false); setIsSignUp(false); setError('') }}
              className="text-sm text-slate-500 hover:text-slate-700"
            >
              Already confirmed? Sign in
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Signup requires a valid beta invite or org invite (invite-only mode)
  const hasValidInvite = !!inviteInfo || !!betaInviteInfo
  const signupBlocked = isSignUp && !hasValidInvite && !inviteToken && !betaInviteToken

  // Show loading while validating beta invite
  if (betaValidating) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-xl shadow-lg p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-gray-500">Validating your invitation...</p>
        </div>
      </div>
    )
  }

  // Show error if beta invite token is invalid
  if (betaInviteError) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-xl shadow-lg p-8 text-center">
          <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <ShieldAlert className="h-8 w-8 text-red-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Invalid Invitation</h1>
          <p className="text-gray-600 mb-4">{betaInviteError}</p>
          <p className="text-sm text-gray-500 mb-6">
            This invitation link may have expired or already been used. Please contact the person who invited you for a new link.
          </p>
          <button
            onClick={() => { setBetaInviteError(null); setIsSignUp(false) }}
            className="text-blue-600 font-semibold hover:underline text-sm"
          >
            Go to Sign In
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Tab-style toggle between Sign In and Sign Up */}
        <div className="flex mb-0 rounded-t-xl overflow-hidden border border-b-0 border-slate-200">
          <button
            onClick={() => { setIsSignUp(false); setError('') }}
            className={`flex-1 py-3 text-sm font-semibold transition-colors ${
              !isSignUp
                ? 'bg-white text-slate-900 border-b-2 border-blue-600'
                : 'bg-slate-50 text-slate-500 hover:text-slate-700'
            }`}
          >
            Sign In
          </button>
          <button
            onClick={() => { setIsSignUp(true); setError('') }}
            className={`flex-1 py-3 text-sm font-semibold transition-colors ${
              isSignUp
                ? 'bg-white text-slate-900 border-b-2 border-blue-600'
                : 'bg-slate-50 text-slate-500 hover:text-slate-700'
            }`}
          >
            Create Account
          </button>
        </div>

        <div className="bg-white rounded-b-xl shadow-lg p-8 border border-t-0 border-slate-200">
          {/* Header changes based on mode */}
          <div className="text-center mb-6">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center mx-auto mb-3">
              <span className="text-white font-bold text-lg">P</span>
            </div>
            {isSignUp ? (
              <>
                <h1 className="text-2xl font-bold text-gray-900">{betaInviteInfo ? 'Activate Your Founding Partner Access' : signupBlocked ? 'Request Beta Access' : 'Start Your Free Trial'}</h1>
                <p className="text-gray-500 mt-1">{betaInviteInfo ? 'Create your account to begin the 30-day program' : signupBlocked ? 'Submit your request to join the Procuvex beta program' : '7 days free — cancel anytime before trial ends'}</p>
                {selectedPlan && !signupBlocked && (
                  <p className="text-blue-600 text-xs font-medium mt-2">
                    {selectedPlan.charAt(0).toUpperCase() + selectedPlan.slice(1)} Plan — {selectedBilling === 'annual' ? 'Annual' : 'Monthly'} billing
                  </p>
                )}
              </>
            ) : (
              <>
                <h1 className="text-2xl font-bold text-gray-900">Welcome Back</h1>
                <p className="text-gray-500 mt-1">Sign in to your Procuvex account</p>
              </>
            )}
          </div>

          {inviteInfo && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 text-center">
              <Mail className="mx-auto text-blue-500 mb-2" size={24} />
              <p className="text-sm text-blue-900 font-medium">
                You've been invited to join <strong>{inviteInfo.org_name}</strong>
              </p>
              <p className="text-xs text-blue-600 mt-1">
                {isSignUp ? 'Create an account to accept the invitation.' : 'Sign in to accept the invitation.'}
              </p>
            </div>
          )}

          {betaInviteInfo && !inviteInfo && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6 text-center">
              <Mail className="mx-auto text-green-500 mb-2" size={24} />
              <p className="text-sm text-green-900 font-medium">
                Welcome to the <strong>Procuvex Founding Partner Program</strong>
              </p>
              <p className="text-xs text-green-600 mt-1">
                Create your account below. Your 30-day program begins at first login.
              </p>
            </div>
          )}

          {/* Signup blocked — invite only, show request form */}
          {signupBlocked ? (
            <BetaRequestForm onSwitchToSignIn={() => { setIsSignUp(false); setError('') }} />
          ) : (

          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignUp && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
                readOnly={!!inviteInfo || !!betaInviteInfo}
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-gray-700">Password</label>
                {!isSignUp && (
                  <Link to="/reset-password" className="text-xs text-blue-600 hover:text-blue-700 font-medium">
                    Forgot password?
                  </Link>
                )}
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
                minLength={6}
              />
            </div>

            {error && (
              <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">{error}</div>
            )}

            <button
              type="submit"
              disabled={loading}
              className={`w-full py-2.5 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-50 ${
                isSignUp
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {loading ? (
                'Please wait...'
              ) : isSignUp ? (
                <><UserPlus size={18} /> {inviteInfo ? 'Create Account & Join' : betaInviteInfo ? 'Activate Founding Partner Access' : 'Start Free Trial'}</>
              ) : (
                <><LogIn size={18} /> {inviteInfo ? 'Sign In & Join' : 'Sign In'}</>
              )}
            </button>
          </form>

          )}

          {/* SSO Sign-in Option */}
          {!isSignUp && !showSso && (
            <div className="mt-4 pt-4 border-t border-slate-200">
              <button
                onClick={() => setShowSso(true)}
                className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-medium text-slate-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
              >
                <KeyRound size={16} />
                Sign in with SSO
              </button>
            </div>
          )}

          {/* SSO Email Form */}
          {!isSignUp && showSso && (
            <div className="mt-4 pt-4 border-t border-slate-200">
              <p className="text-sm font-medium text-slate-700 mb-2">Enterprise SSO</p>
              <form onSubmit={async (e) => {
                e.preventDefault()
                setSsoError('')
                setSsoLoading(true)
                try {
                  const domain = ssoEmail.split('@')[1]
                  if (!domain) { setSsoError('Enter a valid email'); setSsoLoading(false); return }
                  const { data, error: ssoErr } = await supabase.auth.signInWithSSO({ domain })
                  if (ssoErr) { setSsoError(ssoErr.message); setSsoLoading(false); return }
                  if (data?.url) window.location.href = data.url
                } catch {
                  setSsoError('SSO sign-in failed')
                  setSsoLoading(false)
                }
              }} className="space-y-3">
                <input
                  type="email"
                  value={ssoEmail}
                  onChange={(e) => setSsoEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  required
                />
                {ssoError && <p className="text-xs text-red-600">{ssoError}</p>}
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={ssoLoading}
                    className="flex-1 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    {ssoLoading ? 'Redirecting...' : 'Continue with SSO'}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowSso(false); setSsoError('') }}
                    className="px-3 py-2 text-sm text-slate-500 hover:text-slate-700 border border-slate-200 rounded-lg"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Contextual footer based on mode */}
          {isSignUp && !inviteInfo && !signupBlocked && (
            <div className="mt-4 text-center">
              <p className="text-xs text-slate-400">
                By creating an account, you agree to our Terms of Service and Privacy Policy.
              </p>
            </div>
          )}

          <div className="mt-4 pt-4 border-t border-slate-100 text-center">
            <p className="text-xs text-slate-400">
              A product of Core314 Technologies LLC
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
