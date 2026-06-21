import { useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'

export default function ReferralRedirectPage() {
  const { code } = useParams<{ code: string }>()
  const navigate = useNavigate()

  useEffect(() => {
    if (!code) {
      navigate('/', { replace: true })
      return
    }

    // Store referral code in localStorage with 60-day expiry
    const referralData = {
      code,
      timestamp: Date.now(),
      expires: Date.now() + 60 * 24 * 60 * 60 * 1000, // 60 days
    }
    localStorage.setItem('procuvex_referral', JSON.stringify(referralData))

    // Also set a cookie for server-side access
    const expires = new Date(referralData.expires).toUTCString()
    document.cookie = `procuvex_ref=${code}; expires=${expires}; path=/; SameSite=Lax`

    // Validate the referral code then redirect to pricing
    fetch(`/.netlify/functions/partner-program?action=track&code=${code}`)
      .then(r => r.json())
      .then(data => {
        if (data.valid) {
          navigate('/pricing', { replace: true })
        } else {
          navigate('/', { replace: true })
        }
      })
      .catch(() => {
        navigate('/pricing', { replace: true })
      })
  }, [code, navigate])

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="text-center">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center mx-auto mb-4 animate-pulse">
          <span className="text-white font-bold text-sm">P</span>
        </div>
        <p className="text-slate-400 text-sm">Redirecting...</p>
      </div>
    </div>
  )
}
