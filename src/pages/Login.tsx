import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { LogIn, UserPlus, Mail } from 'lucide-react'
import { supabase } from '../lib/supabase'

interface InviteInfo {
  org_name: string
  email: string
  role: string
  token: string
}

export default function Login() {
  const [searchParams] = useSearchParams()
  const inviteToken = searchParams.get('invite')
  const fromPricing = searchParams.get('from') === 'pricing' || document.referrer.includes('/pricing')

  const [isSignUp, setIsSignUp] = useState(!!inviteToken || fromPricing)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [inviteInfo, setInviteInfo] = useState<InviteInfo | null>(null)
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    if (isSignUp) {
      const { error: signUpError } = await signUp(email, password, fullName)
      if (signUpError) {
        setError(signUpError.message)
      } else {
        // If invite token present, accept the invite
        if (inviteToken) {
          // Get the newly created user
          const { data: { user: newUser } } = await supabase.auth.getUser()
          if (newUser) {
            await acceptInvite(newUser.id)
          }
        }
        setError('')
        navigate('/dashboard')
      }
    } else {
      const { error: signInError } = await signIn(email, password)
      if (signInError) {
        setError(signInError.message)
      } else {
        // If existing user signs in via invite link, accept the invite
        if (inviteToken) {
          const { data: { user: existingUser } } = await supabase.auth.getUser()
          if (existingUser) {
            await acceptInvite(existingUser.id)
          }
        }
        navigate('/dashboard')
      }
    }
    setLoading(false)
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
                <h1 className="text-2xl font-bold text-gray-900">Start Your Free Trial</h1>
                <p className="text-gray-500 mt-1">7 days free — no credit card required</p>
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
                readOnly={!!inviteInfo}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
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
                <><UserPlus size={18} /> {inviteInfo ? 'Create Account & Join' : 'Start Free Trial'}</>
              ) : (
                <><LogIn size={18} /> {inviteInfo ? 'Sign In & Join' : 'Sign In'}</>
              )}
            </button>
          </form>

          {/* Contextual footer based on mode */}
          {isSignUp && !inviteInfo && (
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
