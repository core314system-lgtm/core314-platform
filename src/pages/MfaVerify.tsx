import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { ShieldCheck } from 'lucide-react'

interface MfaVerifyProps {
  onVerified: () => void
}

export default function MfaVerify({ onVerified }: MfaVerifyProps) {
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const { data: factors } = await supabase.auth.mfa.listFactors()
      const totpFactor = factors?.totp?.find(f => f.status === 'verified')

      if (!totpFactor) {
        setError('No MFA factor found.')
        setLoading(false)
        return
      }

      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId: totpFactor.id,
      })
      if (challengeError) {
        setError(challengeError.message)
        setLoading(false)
        return
      }

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: totpFactor.id,
        challengeId: challenge.id,
        code,
      })
      if (verifyError) {
        setError('Invalid code. Please try again.')
        setLoading(false)
        return
      }

      onVerified()
    } catch {
      setError('Verification failed. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="bg-white rounded-xl shadow-lg p-8">
          <div className="text-center mb-6">
            <div className="w-14 h-14 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-4">
              <ShieldCheck className="h-7 w-7 text-blue-600" />
            </div>
            <h1 className="text-xl font-bold text-gray-900">Two-Factor Authentication</h1>
            <p className="text-sm text-gray-500 mt-1">Enter the code from your authenticator app</p>
          </div>

          <form onSubmit={handleVerify} className="space-y-4">
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-2xl tracking-[0.3em] text-center"
              placeholder="000000"
              maxLength={6}
              autoFocus
            />

            {error && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{error}</p>}

            <button
              type="submit"
              disabled={code.length !== 6 || loading}
              className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 font-medium"
            >
              {loading ? 'Verifying...' : 'Verify'}
            </button>
          </form>

          <p className="text-xs text-gray-400 text-center mt-4">
            Open your authenticator app to view your code
          </p>
        </div>
      </div>
    </div>
  )
}
