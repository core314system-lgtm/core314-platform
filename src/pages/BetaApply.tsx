import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Shield, Clock, Users, Star, MessageSquare, CheckCircle, Loader2, AlertCircle } from 'lucide-react'

interface InviteInfo {
  email: string
  seats: { total: number; remaining: number }
}

export default function BetaApply() {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [inviteInfo, setInviteInfo] = useState<InviteInfo | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [applicantName, setApplicantName] = useState('')

  const [check1, setCheck1] = useState(false)
  const [check2, setCheck2] = useState(false)
  const [check3, setCheck3] = useState(false)

  useEffect(() => {
    if (!token) { setError('No invitation token'); setLoading(false); return }
    fetch('/.netlify/functions/manage-beta-invites', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, action: 'info' }),
    })
      .then(r => r.json())
      .then(data => {
        if (data.valid) {
          setInviteInfo({ email: data.email, seats: data.seats })
        } else {
          if (data.error === 'already_applied') {
            setError('already_applied')
          } else {
            setError(data.error || 'Invalid invitation')
          }
        }
      })
      .catch(() => setError('Failed to validate invitation'))
      .finally(() => setLoading(false))
  }, [token])

  async function handleApply() {
    if (!token || !check1 || !check2 || !check3) return
    setSubmitting(true)
    try {
      const res = await fetch('/.netlify/functions/manage-beta-invites', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, action: 'apply', applicant_name: applicantName || null }),
      })
      const data = await res.json()
      if (data.success) {
        navigate('/beta/thank-you')
      } else {
        setError(data.error || 'Failed to submit application')
      }
    } catch {
      setError('Network error — please try again')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    )
  }

  if (error === 'already_applied') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="max-w-md text-center">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Application Already Submitted</h1>
          <p className="text-gray-600">Your application for the Founding Partner Program is under review. You'll receive an email when a decision has been made.</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="max-w-md text-center">
          <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Invitation Not Valid</h1>
          <p className="text-gray-600">{error}</p>
          <a href="https://procuvex.com" className="mt-4 inline-block text-blue-600 hover:underline">Visit procuvex.com</a>
        </div>
      </div>
    )
  }

  if (!inviteInfo) return null

  const allChecked = check1 && check2 && check3

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <div className="text-center pt-12 pb-6 px-4">
        <p className="text-blue-400 text-xs uppercase tracking-[3px] mb-3">Founding Partner Program</p>
        <h1 className="text-3xl md:text-4xl font-bold text-white mb-3">Procuvex Private Beta</h1>
        <p className="text-slate-400 text-sm max-w-md mx-auto">AI-Powered Procurement Intelligence for Complex Bid & Subcontractor Workflows</p>
      </div>

      {/* Seats Banner */}
      <div className="max-w-2xl mx-auto px-4 mb-8">
        <div className="bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/40 rounded-lg p-4 text-center">
          <p className="text-amber-300 font-semibold text-sm">
            <Users className="w-4 h-4 inline mr-1.5 -mt-0.5" />
            {inviteInfo.seats.remaining} of {inviteInfo.seats.total} Founding Partner seats remaining
          </p>
          <div className="mt-2 h-2 bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-amber-400 to-orange-500 rounded-full transition-all"
              style={{ width: `${((inviteInfo.seats.total - inviteInfo.seats.remaining) / inviteInfo.seats.total) * 100}%` }}
            />
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 pb-16">
        {/* What is Procuvex */}
        <section className="bg-white/5 backdrop-blur rounded-xl p-6 mb-6 border border-white/10">
          <h2 className="text-lg font-semibold text-white mb-3">What is Procuvex?</h2>
          <p className="text-slate-300 text-sm leading-relaxed mb-4">
            Procuvex is an AI-powered procurement intelligence platform built from real-world federal procurement and multi-site facility management operations. It helps procurement professionals:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              'Cut proposal preparation time by 60%',
              'Find qualified subcontractors faster',
              'Identify compliance gaps automatically',
              'Centralize task order management',
              'Improve win probability with AI analysis',
              'Eliminate manual spreadsheet workflows',
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                <span className="text-slate-300 text-sm">{item}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Benefits */}
        <section className="bg-white/5 backdrop-blur rounded-xl p-6 mb-6 border border-white/10">
          <h2 className="text-lg font-semibold text-white mb-3">
            <Star className="w-5 h-5 inline text-amber-400 mr-2 -mt-0.5" />
            Founding Partner Benefits
          </h2>
          <ul className="space-y-3">
            {[
              { icon: Shield, text: 'Complimentary full-platform access during the 30-day program' },
              { icon: Star, text: '25% lifetime discount on your chosen plan upon program completion' },
              { icon: MessageSquare, text: 'Direct access to the development team for feedback' },
              { icon: Users, text: 'Early influence on platform direction and features' },
              { icon: CheckCircle, text: '"Founding Partner" designation on your account' },
            ].map((item, i) => (
              <li key={i} className="flex items-start gap-3">
                <item.icon className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
                <span className="text-slate-300 text-sm">{item.text}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Program Expectations */}
        <section className="bg-white/5 backdrop-blur rounded-xl p-6 mb-6 border border-white/10">
          <h2 className="text-lg font-semibold text-white mb-3">
            <Clock className="w-5 h-5 inline text-blue-400 mr-2 -mt-0.5" />
            Program Expectations
          </h2>
          <p className="text-slate-400 text-sm mb-3">We're looking for procurement professionals willing to actively test and provide feedback:</p>
          <ul className="space-y-2 text-sm text-slate-300">
            <li className="flex items-start gap-2"><span className="text-blue-400 font-bold">1.</span> Active testing for 30 days (starting from your first login)</li>
            <li className="flex items-start gap-2"><span className="text-blue-400 font-bold">2.</span> Upload at least one project and explore core features</li>
            <li className="flex items-start gap-2"><span className="text-blue-400 font-bold">3.</span> Complete 4 weekly feedback forms (progressive, covering different aspects)</li>
            <li className="flex items-start gap-2"><span className="text-blue-400 font-bold">4.</span> Report bugs and usability issues through the in-app feedback widget</li>
            <li className="flex items-start gap-2"><span className="text-blue-400 font-bold">5.</span> Complete all program guidelines to earn your 25% lifetime discount</li>
          </ul>
        </section>

        {/* Agreement */}
        <section className="bg-white/5 backdrop-blur rounded-xl p-6 mb-6 border border-white/10">
          <h2 className="text-lg font-semibold text-white mb-3">
            <Shield className="w-5 h-5 inline text-blue-400 mr-2 -mt-0.5" />
            Founding Partner Agreement
          </h2>
          <div className="bg-slate-900/50 rounded-lg p-4 max-h-64 overflow-y-auto text-xs text-slate-400 leading-relaxed mb-4 border border-slate-700">
            <p className="font-semibold text-slate-300 mb-2">PROCUVEX FOUNDING PARTNER PROGRAM AGREEMENT</p>
            <p className="mb-2">By applying to the Procuvex Founding Partner Program, you agree to the following terms:</p>

            <p className="font-semibold text-slate-300 mt-3 mb-1">1. CONFIDENTIALITY</p>
            <p>You agree not to share proprietary features, screenshots, or internal platform details with unauthorized parties during the beta period. General commentary about your experience is permitted.</p>

            <p className="font-semibold text-slate-300 mt-3 mb-1">2. DATA HANDLING</p>
            <p>Data entered during the beta period is stored securely. Test data may be subject to migration or cleanup as the platform evolves. Procuvex will make reasonable efforts to preserve your data through the transition to general availability.</p>

            <p className="font-semibold text-slate-300 mt-3 mb-1">3. FEEDBACK USAGE</p>
            <p>Feedback, suggestions, and bug reports you submit may be used for product development, marketing materials (with your permission for attributed quotes), and internal analysis. Your identity will not be disclosed without consent.</p>

            <p className="font-semibold text-slate-300 mt-3 mb-1">4. PRE-RELEASE SOFTWARE</p>
            <p>Procuvex is pre-release software. You may experience bugs, downtime, incomplete features, or data inconsistencies. Procuvex is provided "as-is" during the beta period without warranty of uninterrupted service.</p>

            <p className="font-semibold text-slate-300 mt-3 mb-1">5. PROGRAM DURATION & ACCESS</p>
            <p>The Founding Partner Program runs for 30 days from your first login. Access to the platform during this period is complimentary. Continued access after the program requires an active subscription.</p>

            <p className="font-semibold text-slate-300 mt-3 mb-1">6. DISCOUNT TERMS</p>
            <p>Upon completing all program requirements (4 weekly feedback forms), you will receive a unique 25% lifetime discount code valid for any Procuvex subscription plan. The code must be redeemed within 5 days of program completion. The discount applies for the life of your active subscription. If your subscription is cancelled or lapses, the discount is forfeited and standard pricing applies if you re-subscribe.</p>

            <p className="font-semibold text-slate-300 mt-3 mb-1">7. ACCEPTANCE & REVIEW</p>
            <p>Submitting this application does not guarantee acceptance. Applications are reviewed by the Procuvex team, and acceptance is at our sole discretion based on available seats and applicant fit. You will be notified of the decision via email.</p>

            <p className="text-slate-500 mt-4">Last updated: May 2026 | Core314 Technologies LLC</p>
          </div>

          {/* Name input */}
          <div className="mb-4">
            <label className="block text-sm text-slate-300 mb-1.5">Your Full Name</label>
            <input
              type="text"
              value={applicantName}
              onChange={e => setApplicantName(e.target.value)}
              placeholder="Enter your full name"
              className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Checkboxes */}
          <div className="space-y-3">
            <label className="flex items-start gap-3 cursor-pointer group">
              <input type="checkbox" checked={check1} onChange={e => setCheck1(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-slate-600 bg-slate-800 text-blue-500 focus:ring-blue-500" />
              <span className="text-sm text-slate-300 group-hover:text-white transition-colors">
                I have read and agree to the Founding Partner Program Agreement
              </span>
            </label>
            <label className="flex items-start gap-3 cursor-pointer group">
              <input type="checkbox" checked={check2} onChange={e => setCheck2(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-slate-600 bg-slate-800 text-blue-500 focus:ring-blue-500" />
              <span className="text-sm text-slate-300 group-hover:text-white transition-colors">
                I understand this is pre-release software and may contain bugs or incomplete features
              </span>
            </label>
            <label className="flex items-start gap-3 cursor-pointer group">
              <input type="checkbox" checked={check3} onChange={e => setCheck3(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-slate-600 bg-slate-800 text-blue-500 focus:ring-blue-500" />
              <span className="text-sm text-slate-300 group-hover:text-white transition-colors">
                I commit to actively testing and providing weekly feedback during the 30-day program
              </span>
            </label>
          </div>
        </section>

        {/* Apply button */}
        <div className="text-center">
          <button
            onClick={handleApply}
            disabled={!allChecked || submitting}
            className={`px-10 py-4 rounded-lg font-bold text-lg transition-all ${
              allChecked && !submitting
                ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white hover:from-blue-700 hover:to-blue-800 shadow-lg shadow-blue-500/25'
                : 'bg-slate-700 text-slate-500 cursor-not-allowed'
            }`}
          >
            {submitting ? <Loader2 className="w-5 h-5 animate-spin inline mr-2" /> : null}
            {submitting ? 'Submitting...' : 'Apply for Founding Partner Program'}
          </button>
          <p className="text-slate-500 text-xs mt-3">
            Applying for: <span className="text-slate-400">{inviteInfo.email}</span>
          </p>
        </div>
      </div>
    </div>
  )
}
