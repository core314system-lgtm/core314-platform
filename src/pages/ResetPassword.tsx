import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { KeyRound, ArrowLeft, CheckCircle, Mail } from 'lucide-react'

type Mode = 'request' | 'update'

export default function ResetPassword() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  // If URL has access_token or type=recovery, we're in update mode
  const [mode, setMode] = useState<Mode>('request')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    // Check if this is a password recovery callback
    const hashParams = new URLSearchParams(window.location.hash.substring(1))
    const type = hashParams.get('type') || searchParams.get('type')
    if (type === 'recovery') {
      setMode('update')
    }

    // Listen for password recovery event
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setMode('update')
      }
    })

    return () => subscription.unsubscribe()
  }, [searchParams])

  async function handleRequestReset(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })

    if (error) {
      setError(error.message)
    } else {
      setSuccess(true)
    }
    setLoading(false)
  }

  async function handleUpdatePassword(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    setLoading(true)

    const { error } = await supabase.auth.updateUser({ password })

    if (error) {
      setError(error.message)
    } else {
      setSuccess(true)
      setTimeout(() => navigate('/login'), 3000)
    }
    setLoading(false)
  }

  // Success state for password reset request
  if (success && mode === 'request') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-xl shadow-lg p-8 text-center">
          <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <Mail className="h-8 w-8 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Check Your Email</h1>
          <p className="text-gray-600 mb-4">
            We sent a password reset link to <strong>{email}</strong>
          </p>
          <p className="text-sm text-gray-500 mb-6">
            Click the link in the email to set a new password. The link expires in 1 hour.
          </p>
          <button
            onClick={() => navigate('/login')}
            className="text-blue-600 hover:text-blue-700 text-sm font-medium"
          >
            Back to Sign In
          </button>
        </div>
      </div>
    )
  }

  // Success state for password update
  if (success && mode === 'update') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-xl shadow-lg p-8 text-center">
          <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Password Updated</h1>
          <p className="text-gray-600 mb-4">
            Your password has been successfully changed. Redirecting to sign in...
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-xl shadow-lg p-8">
          <div className="text-center mb-6">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center mx-auto mb-3">
              <KeyRound className="h-5 w-5 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">
              {mode === 'request' ? 'Reset Password' : 'Set New Password'}
            </h1>
            <p className="text-gray-500 mt-1">
              {mode === 'request'
                ? 'Enter your email and we\'ll send you a reset link'
                : 'Choose a new password for your account'}
            </p>
          </div>

          <form onSubmit={mode === 'request' ? handleRequestReset : handleUpdatePassword} className="space-y-4">
            {mode === 'request' ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="you@company.com"
                  required
                />
              </div>
            ) : (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="At least 6 characters"
                    required
                    minLength={6}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Re-enter your new password"
                    required
                    minLength={6}
                  />
                </div>
              </>
            )}

            {error && (
              <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">{error}</div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {loading
                ? 'Please wait...'
                : mode === 'request'
                  ? 'Send Reset Link'
                  : 'Update Password'}
            </button>
          </form>

          <div className="mt-4 text-center">
            <button
              onClick={() => navigate('/login')}
              className="text-sm text-slate-500 hover:text-slate-700 inline-flex items-center gap-1"
            >
              <ArrowLeft size={14} /> Back to Sign In
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
