import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'

export default function BetaPending() {
  const navigate = useNavigate()
  const [checking, setChecking] = useState(false)
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

  const handleCheckStatus = async () => {
    setChecking(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        navigate('/login')
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('beta_status')
        .eq('id', session.user.id)
        .single()

      if (profile?.beta_status === 'approved') {
        navigate('/dashboard')
      } else if (profile?.beta_status === 'revoked') {
        navigate('/beta-revoked')
      } else {
        alert('Your beta access is still pending approval. You will be notified by email once approved.')
      }
    } catch (error) {
      console.error('Error checking status:', error)
      alert('Failed to check status. Please try again later.')
    } finally {
      setChecking(false)
    }
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    navigate('/login')
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
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#00BFFF]/20 to-[#007BFF]/20 flex items-center justify-center">
              <svg className="w-10 h-10 text-[#00BFFF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>

          {/* Title */}
          <h2 className="text-3xl font-bold text-white text-center mb-4">
            Beta Access Pending
          </h2>

          {/* Message */}
          <div className="text-center mb-8">
            <p className="text-gray-300 text-lg mb-4">
              Your Core314 beta access request is awaiting approval.
            </p>
            <p className="text-gray-400">
              You will be notified by email once your access has been approved. This typically takes 24-48 hours.
            </p>
            {userEmail && (
              <p className="text-gray-500 text-sm mt-4">
                We'll send the notification to: <span className="text-[#00BFFF]">{userEmail}</span>
              </p>
            )}
          </div>

          {/* Info Box */}
          <div className="bg-[#0A0F1A] border border-[#2A3F5F] rounded-lg p-6 mb-8">
            <h3 className="text-[#00BFFF] font-semibold mb-3 flex items-center">
              <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              What happens next?
            </h3>
            <ul className="text-gray-400 space-y-2 text-sm">
              <li className="flex items-start">
                <span className="text-[#00BFFF] mr-2">1.</span>
                <span>Our team reviews your beta access request</span>
              </li>
              <li className="flex items-start">
                <span className="text-[#00BFFF] mr-2">2.</span>
                <span>You receive an email notification when approved</span>
              </li>
              <li className="flex items-start">
                <span className="text-[#00BFFF] mr-2">3.</span>
                <span>Log in to access your Core314 dashboard</span>
              </li>
            </ul>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-4">
            <button
              onClick={handleCheckStatus}
              disabled={checking}
              className="flex-1 bg-gradient-to-r from-[#00BFFF] to-[#007BFF] text-white font-semibold py-3 px-6 rounded-lg hover:shadow-lg hover:shadow-[#00BFFF]/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {checking ? 'Checking...' : 'Check Status'}
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
            Need help? Contact us at{' '}
            <a href="mailto:support@core314.com" className="text-[#00BFFF] hover:underline">
              support@core314.com
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}
