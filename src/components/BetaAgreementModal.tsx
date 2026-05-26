import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { Shield, FileText, CheckCircle } from 'lucide-react'

interface Props {
  userId: string
  userName: string
  onAccepted: () => void
}

const BETA_AGREEMENT_TEXT = `
PROCUVEX BETA TESTING AGREEMENT

Last Updated: May 2026

By participating in the Procuvex Beta Testing Program ("Program"), you agree to the following terms:

1. PURPOSE
You are invited to test pre-release features of the Procuvex platform. Your feedback helps us improve the product before general availability.

2. CONFIDENTIALITY
You agree to keep all beta features, designs, and non-public information confidential. You will not share screenshots, data, or descriptions of unreleased features with anyone outside the Program.

3. FEEDBACK & DATA
- You agree to provide constructive feedback when requested
- Usage data and analytics may be collected to improve the platform
- Feedback you provide may be used to improve Procuvex without additional compensation

4. SERVICE LEVEL
- Beta features may contain bugs or incomplete functionality
- Procuvex is provided "as is" during the beta period
- Core314 Technologies LLC is not liable for data loss during beta testing
- We recommend maintaining backups of critical business data

5. BETA DISCOUNT INCENTIVE
- Eligible beta testers who complete the program requirements will receive a one-time discount on their chosen subscription plan
- The discount applies for the duration of your continuous subscription
- If your subscription is cancelled, terminated, or deactivated for any reason, the discount is forfeited
- Re-subscribing after cancellation will be at the then-current advertised rate

6. PROGRAM REQUIREMENTS
To maintain beta tester status and associated benefits:
- Use the platform regularly during the beta period
- Report bugs and issues through the in-app support system
- Complete feedback surveys when requested
- Maintain professional conduct in all communications

7. TERMINATION
Core314 Technologies LLC reserves the right to remove any participant from the Program at any time, with or without cause. You may withdraw from the Program at any time by contacting support.

8. ACCEPTANCE
By clicking "I Accept", you acknowledge that you have read, understood, and agree to be bound by the terms of this Beta Testing Agreement.
`.trim()

export default function BetaAgreementModal({ userId, userName, onAccepted }: Props) {
  const [agreed, setAgreed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [scrolledToBottom, setScrolledToBottom] = useState(false)

  function handleScroll(e: React.UIEvent<HTMLDivElement>) {
    const el = e.currentTarget
    const atBottom = el.scrollHeight - el.scrollTop <= el.clientHeight + 20
    if (atBottom) setScrolledToBottom(true)
  }

  async function handleAccept() {
    if (!agreed) return
    setLoading(true)

    // Record acceptance in user_profiles
    await supabase
      .from('user_profiles')
      .update({
        beta_agreement_accepted_at: new Date().toISOString(),
        beta_agreement_version: '2026-05',
      })
      .eq('id', userId)

    setLoading(false)
    onAccepted()
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
              <Shield className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Beta Testing Agreement</h2>
              <p className="text-sm text-gray-500">Welcome to the Procuvex Beta Program, {userName}!</p>
            </div>
          </div>
        </div>

        {/* Agreement Text */}
        <div
          className="flex-1 overflow-y-auto p-6 bg-gray-50"
          onScroll={handleScroll}
        >
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="flex items-center gap-2 mb-4">
              <FileText className="h-5 w-5 text-gray-400" />
              <h3 className="font-semibold text-gray-900">Terms & Conditions</h3>
            </div>
            <pre className="whitespace-pre-wrap text-sm text-gray-700 font-sans leading-relaxed">
              {BETA_AGREEMENT_TEXT}
            </pre>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 flex-shrink-0">
          {!scrolledToBottom && (
            <p className="text-xs text-amber-600 mb-3 flex items-center gap-1">
              Please scroll to the bottom of the agreement to continue
            </p>
          )}
          <label className="flex items-start gap-3 mb-4 cursor-pointer">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              disabled={!scrolledToBottom}
              className="mt-0.5 w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
            />
            <span className={`text-sm ${scrolledToBottom ? 'text-gray-700' : 'text-gray-400'}`}>
              I have read and agree to the Beta Testing Agreement. I understand that my beta discount is contingent on
              maintaining an active subscription and completing program requirements.
            </span>
          </label>
          <button
            onClick={handleAccept}
            disabled={!agreed || loading}
            className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 font-semibold flex items-center justify-center gap-2"
          >
            {loading ? (
              'Processing...'
            ) : (
              <>
                <CheckCircle className="h-4 w-4" />
                I Accept — Start Beta Testing
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
