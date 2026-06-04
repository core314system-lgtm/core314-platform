import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import {
  Loader2, CheckCircle, XCircle,
  Building, MapPin, FileText, Clock, Lock,
} from 'lucide-react'

interface PendingSub {
  id: string
  company_name: string
  slug: string
  state: string | null
  city: string | null
  contact_email: string | null
  verification_status: string
  trade_categories: string[]
  small_business_types: string[]
  claimed_at: string | null
  profile_completeness: number
}

interface Certification {
  id: string
  master_sub_id: string
  cert_type: string
  cert_name: string
  expiration_date: string | null
  status: string
  uploaded_at: string
}

export default function AdminVerificationReview() {
  const { profile: authProfile, loading: authLoading } = useAuth()
  const isAdmin = authProfile?.is_global_admin === true

  const [subs, setSubs] = useState<PendingSub[]>([])
  const [certs, setCerts] = useState<Certification[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [rejectNotes, setRejectNotes] = useState('')
  const [showRejectFor, setShowRejectFor] = useState<string | null>(null)

  useEffect(() => {
    if (isAdmin) fetchPending()
  }, [isAdmin])

  async function fetchPending() {
    setLoading(true)
    const res = await fetch('/.netlify/functions/sub-verification?status=pending_verification', {
      headers: { 'x-user-id': authProfile?.id || '' },
    })
    const data = await res.json()
    if (!data.error) {
      setSubs(data.subs || [])
      setCerts(data.certifications || [])
    }
    setLoading(false)
  }

  async function handleDecision(subId: string, decision: 'approve' | 'reject') {
    setActionLoading(subId)
    await fetch('/.netlify/functions/sub-verification', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-user-id': authProfile?.id || '' },
      body: JSON.stringify({ sub_id: subId, decision, notes: rejectNotes }),
    })
    setSubs(subs.filter(s => s.id !== subId))
    setActionLoading(null)
    setShowRejectFor(null)
    setRejectNotes('')
  }

  if (authLoading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin" size={32} /></div>
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <Lock size={48} className="text-gray-400" />
        <h2 className="text-xl font-semibold text-gray-700">Admin Access Required</h2>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Verification Review</h1>
        <p className="text-sm text-gray-500 mt-1">Review and approve subcontractor verification requests</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32"><Loader2 className="animate-spin" size={24} /></div>
      ) : subs.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <CheckCircle size={32} className="mx-auto text-green-400 mb-3" />
          <p className="text-gray-500">No pending verification requests</p>
        </div>
      ) : (
        <div className="space-y-4">
          {subs.map(sub => {
            const subCerts = certs.filter(c => c.master_sub_id === sub.id)
            return (
              <div key={sub.id} className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                      <Building size={16} className="text-blue-500" />
                      {sub.company_name}
                    </h3>
                    <div className="flex items-center gap-3 mt-1">
                      {(sub.city || sub.state) && (
                        <span className="flex items-center gap-1 text-xs text-gray-500">
                          <MapPin size={11} /> {[sub.city, sub.state].filter(Boolean).join(', ')}
                        </span>
                      )}
                      {sub.contact_email && (
                        <span className="text-xs text-gray-400">{sub.contact_email}</span>
                      )}
                      <span className="text-xs text-gray-400">Profile: {sub.profile_completeness}%</span>
                    </div>
                    {sub.trade_categories?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {sub.trade_categories.slice(0, 5).map(t => (
                          <span key={t} className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">{t}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <Link to={`/sub/${sub.slug}`} target="_blank" className="text-xs text-blue-500 hover:text-blue-700">
                    View Profile →
                  </Link>
                </div>

                {/* Documents */}
                {subCerts.length > 0 && (
                  <div className="border-t border-gray-100 pt-3">
                    <p className="text-xs font-medium text-gray-600 mb-2 flex items-center gap-1">
                      <FileText size={12} /> Uploaded Documents ({subCerts.length})
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {subCerts.map(cert => (
                        <div key={cert.id} className="flex items-center justify-between p-2 bg-gray-50 rounded text-xs">
                          <div>
                            <span className="font-medium text-gray-700">{cert.cert_name}</span>
                            <span className="text-gray-400 ml-2">{cert.cert_type}</span>
                          </div>
                          {cert.expiration_date && (
                            <span className="flex items-center gap-1 text-gray-400">
                              <Clock size={10} /> {new Date(cert.expiration_date).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="border-t border-gray-100 pt-3 flex items-center gap-2">
                  <button
                    onClick={() => handleDecision(sub.id, 'approve')}
                    disabled={actionLoading === sub.id}
                    className="flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 disabled:opacity-50"
                  >
                    {actionLoading === sub.id ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={12} />}
                    Approve
                  </button>
                  <button
                    onClick={() => setShowRejectFor(showRejectFor === sub.id ? null : sub.id)}
                    className="flex items-center gap-1.5 px-4 py-2 border border-red-300 text-red-700 rounded-lg text-xs font-medium hover:bg-red-50"
                  >
                    <XCircle size={12} /> Reject
                  </button>
                </div>

                {showRejectFor === sub.id && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 space-y-2">
                    <input
                      type="text"
                      value={rejectNotes}
                      onChange={e => setRejectNotes(e.target.value)}
                      placeholder="Reason for rejection (sent to sub)"
                      className="w-full px-3 py-2 border border-red-300 rounded text-xs"
                    />
                    <button
                      onClick={() => handleDecision(sub.id, 'reject')}
                      disabled={actionLoading === sub.id}
                      className="px-3 py-1.5 bg-red-600 text-white rounded text-xs font-medium hover:bg-red-700 disabled:opacity-50"
                    >
                      Confirm Rejection
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
