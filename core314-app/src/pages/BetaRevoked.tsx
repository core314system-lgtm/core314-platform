import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'

export default function BetaRevoked() {
  const navigate = useNavigate()
  const [userEmail, setUserEmail] = useState<string>('')

  useEffect(() => {
    async function getUserEmail() {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user?.email) {
        setUserEmail(session.user.email)
      }
    }
    getUserEmail()
  }, [])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    navigate('/login')
  }

  const handleContactSupport = () => {
    window.location.href = 'https://core314.com/contact'
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0F1A] via-[#1A1F2E] to-[#0A0F1A] flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#00BFFF] to-[#007BFF] mb-2">
            CORE314
          </h1>
          <p className="text-gray-400 text-sm">Logic in Motion. Intelligence in Control.</p>
        </div>

        {/* Main Card */}
        <div className="bg-[#1A1F2E] border border-[#2A3F5F] rounded-xl p-8 shadow-2xl">
          {/* Icon */}
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-red-500/20 to-red-700/20 flex items-center justify-center">
              <svg className="w-10 h-10 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
          </div>

          {/* Title */}
          <h2 className="text-3xl font-bold text-white text-center mb-4">
            Beta Access Revoked
          </h2>

          {/* Message */}
          <div className="text-center mb-8">
            <p className="text-gray-300 text-lg mb-4">
              Your Core314 beta access has been revoked.
            </p>
            <p className="text-gray-400">
              You will no longer be able to access the Core314 platform. If you believe this is an error, please contact our support team.
            </p>
            {userEmail && (
              <p className="text-gray-500 text-sm mt-4">
                Account: <span className="text-red-400">{userEmail}</span>
              </p>
            )}
          </div>

          {/* Warning Box */}
          <div className="bg-red-950/30 border border-red-900/50 rounded-lg p-6 mb-8">
            <h3 className="text-red-400 font-semibold mb-3 flex items-center">
              <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              What This Means
            </h3>
            <p className="text-gray-400 text-sm mb-4">
              Your account remains active, but access to the Core314 dashboard and features has been temporarily suspended.
            </p>
            <div className="text-gray-400 text-sm">
              <p className="font-semibold text-gray-300 mb-2">Common reasons for access revocation:</p>
              <ul className="space-y-1 ml-4">
                <li>• Beta program capacity limits reached</li>
                <li>• Terms of service violations</li>
                <li>• Extended period of inactivity</li>
                <li>• Administrative review or account verification required</li>
              </ul>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-4">
            <button
              onClick={handleContactSupport}
              className="flex-1 bg-gradient-to-r from-[#00BFFF] to-[#007BFF] text-white font-semibold py-3 px-6 rounded-lg hover:shadow-lg hover:shadow-[#00BFFF]/50 transition-all"
            >
              Contact Support
            </button>
            <button
              onClick={handleSignOut}
              className="flex-1 bg-[#2A3F5F] text-gray-300 font-semibold py-3 px-6 rounded-lg hover:bg-[#3A4F6F] transition-all"
            >
              Sign Out
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-8 text-gray-500 text-sm">
          <p>
            Questions? Email us at{' '}
            <a href="mailto:support@core314.com" className="text-[#00BFFF] hover:underline">
              support@core314.com
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}
