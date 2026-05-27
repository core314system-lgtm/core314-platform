import { CheckCircle, Clock, Mail } from 'lucide-react'

export default function BetaThankYou() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-6">
      <div className="max-w-lg text-center">
        <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle className="w-10 h-10 text-green-400" />
        </div>

        <h1 className="text-3xl font-bold text-white mb-4">
          Thank You for Your Interest
        </h1>

        <p className="text-slate-300 text-lg mb-6 leading-relaxed">
          Your application for the <span className="text-blue-400 font-semibold">Procuvex Founding Partner Program</span> has been received.
        </p>

        <div className="bg-white/5 backdrop-blur rounded-xl p-6 border border-white/10 text-left space-y-4 mb-8">
          <div className="flex items-start gap-3">
            <Clock className="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-white font-medium text-sm">Application Under Review</p>
              <p className="text-slate-400 text-sm">Being that this is an invitation-only opportunity, your application is being reviewed by our team.</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Mail className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-white font-medium text-sm">We'll Be in Touch</p>
              <p className="text-slate-400 text-sm">Someone will be reaching out to you shortly with further details about your application status.</p>
            </div>
          </div>
        </div>

        <p className="text-slate-500 text-sm mb-6">
          In the meantime, learn more about how Procuvex works at{' '}
          <a href="https://procuvex.com" className="text-blue-400 hover:underline">procuvex.com</a>
        </p>

        <p className="text-slate-600 text-xs">
          Procuvex — A product of Core314 Technologies LLC
        </p>
      </div>
    </div>
  )
}
