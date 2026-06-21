import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Mail, ArrowRight, CheckCircle, LogIn } from 'lucide-react'
import Header from '../components/Header'
import Footer from '../components/Footer'

export default function PartnerLoginPage() {
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    if (!email) return
    setSubmitting(true)
    setError('')

    try {
      const res = await fetch('/.netlify/functions/partner-program', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'login',
          email: email.toLowerCase().trim(),
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setSent(true)
      } else {
        setError(data.error || 'Something went wrong. Please try again.')
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <Header />

      <section className="pt-28 pb-20 px-4">
        <div className="max-w-md mx-auto">
          <div className="text-center mb-10">
            <div className="w-16 h-16 rounded-full bg-purple-500/20 border border-purple-500/30 flex items-center justify-center mx-auto mb-4">
              <LogIn className="w-8 h-8 text-purple-400" />
            </div>
            <h1 className="text-3xl font-bold mb-2">Partner Login</h1>
            <p className="text-slate-400">
              Enter your email to receive a secure login link for your partner dashboard.
            </p>
          </div>

          {sent ? (
            <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-8 text-center">
              <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-3" />
              <h3 className="text-xl font-semibold text-white mb-2">Login Link Sent!</h3>
              <p className="text-slate-400 text-sm">
                If an active partner account exists for <strong className="text-white">{email}</strong>,
                you'll receive a login link shortly. Check your inbox.
              </p>
            </div>
          ) : (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1.5">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    placeholder="you@example.com"
                    className="w-full pl-11 pr-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting || !email}
                className="w-full py-3 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {submitting ? 'Sending...' : 'Send Login Link'}
                {!submitting && <ArrowRight className="w-4 h-4" />}
              </button>

              {error && <p className="text-red-400 text-sm text-center">{error}</p>}

              <p className="text-center text-sm text-slate-500 pt-2">
                Don't have a partner account?{' '}
                <Link to="/partners" className="text-purple-400 hover:text-purple-300">
                  Apply here
                </Link>
              </p>
            </form>
          )}
        </div>
      </section>

      <Footer />
    </div>
  )
}
