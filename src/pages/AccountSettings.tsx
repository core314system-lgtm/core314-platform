import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useOrg } from '../contexts/OrgContext'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'
import { User, KeyRound, Trash2, Download, AlertTriangle, CheckCircle, Shield, Smartphone, ShieldCheck, ShieldOff } from 'lucide-react'

export default function AccountSettings() {
  const { user, signOut } = useAuth()
  const { currentOrg: org } = useOrg()
  const navigate = useNavigate()
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordLoading, setPasswordLoading] = useState(false)
  const [passwordError, setPasswordError] = useState('')
  const [passwordSuccess, setPasswordSuccess] = useState(false)

  // Account deletion
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  // Data export
  const [exportLoading, setExportLoading] = useState(false)

  // MFA state
  const [mfaFactors, setMfaFactors] = useState<{ id: string; friendly_name?: string; status: string }[]>([])
  const [mfaLoading, setMfaLoading] = useState(true)
  const [enrolling, setEnrolling] = useState(false)
  const [enrollData, setEnrollData] = useState<{ id: string; qr: string; secret: string } | null>(null)
  const [verifyCode, setVerifyCode] = useState('')
  const [mfaError, setMfaError] = useState('')
  const [mfaSuccess, setMfaSuccess] = useState('')
  const [unenrolling, setUnenrolling] = useState(false)

  useEffect(() => {
    loadMfaFactors()
  }, [])

  async function loadMfaFactors() {
    setMfaLoading(true)
    const { data, error } = await supabase.auth.mfa.listFactors()
    if (!error && data) {
      setMfaFactors(data.totp.map(f => ({ id: f.id, friendly_name: f.friendly_name || undefined, status: f.status })))
    }
    setMfaLoading(false)
  }

  async function handleEnrollMfa() {
    setMfaError('')
    setMfaSuccess('')
    setEnrolling(true)
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: 'Authenticator App',
    })
    if (error) {
      setMfaError(error.message)
      setEnrolling(false)
      return
    }
    setEnrollData({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret })
  }

  async function handleVerifyEnrollment() {
    if (!enrollData) return
    setMfaError('')
    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId: enrollData.id })
    if (challengeError) {
      setMfaError(challengeError.message)
      return
    }
    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId: enrollData.id,
      challengeId: challenge.id,
      code: verifyCode,
    })
    if (verifyError) {
      setMfaError('Invalid code. Please try again.')
      return
    }
    setMfaSuccess('Two-factor authentication enabled successfully!')
    setEnrollData(null)
    setEnrolling(false)
    setVerifyCode('')
    loadMfaFactors()
  }

  async function handleUnenrollMfa(factorId: string) {
    setMfaError('')
    setMfaSuccess('')
    setUnenrolling(true)
    const { error } = await supabase.auth.mfa.unenroll({ factorId })
    if (error) {
      setMfaError(error.message)
    } else {
      setMfaSuccess('Two-factor authentication has been disabled.')
      loadMfaFactors()
    }
    setUnenrolling(false)
  }

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault()
    setPasswordError('')
    setPasswordSuccess(false)

    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match')
      return
    }
    if (newPassword.length < 6) {
      setPasswordError('Password must be at least 6 characters')
      return
    }

    setPasswordLoading(true)
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) {
      setPasswordError(error.message)
    } else {
      setPasswordSuccess(true)
      setNewPassword('')
      setConfirmPassword('')
    }
    setPasswordLoading(false)
  }

  async function handleExportData() {
    if (!org?.id) return
    setExportLoading(true)
    try {
      const res = await fetch('/.netlify/functions/export-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ org_id: org.id, format: 'json' }),
      })
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `procuvex-export-${new Date().toISOString().split('T')[0]}.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      // silently fail
    }
    setExportLoading(false)
  }

  async function handleDeleteAccount() {
    if (deleteConfirmText !== 'DELETE MY ACCOUNT') return
    setDeleteLoading(true)
    setDeleteError('')

    try {
      // Call the delete-account function
      const res = await fetch('/.netlify/functions/delete-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user?.id, org_id: org?.id }),
      })
      const data = await res.json()
      if (!res.ok) {
        setDeleteError(data.error || 'Failed to delete account')
        setDeleteLoading(false)
        return
      }
      // Sign out and redirect
      await signOut()
      navigate('/login')
    } catch {
      setDeleteError('Failed to delete account. Please contact support.')
      setDeleteLoading(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold text-gray-900 mb-1 flex items-center gap-2">
        <User className="h-6 w-6 text-blue-600" />
        Account Settings
      </h1>
      <p className="text-gray-500 mb-8">Manage your account, security, and data</p>

      {/* Account Info */}
      <section className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Shield className="h-5 w-5 text-gray-400" />
          Account Information
        </h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between py-2 border-b border-gray-100">
            <span className="text-sm text-gray-500">Email</span>
            <span className="text-sm font-medium text-gray-900">{user?.email}</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-gray-100">
            <span className="text-sm text-gray-500">Organization</span>
            <span className="text-sm font-medium text-gray-900">{org?.name || 'N/A'}</span>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-sm text-gray-500">Member since</span>
            <span className="text-sm font-medium text-gray-900">
              {user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}
            </span>
          </div>
        </div>
      </section>

      {/* Change Password */}
      <section className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <KeyRound className="h-5 w-5 text-gray-400" />
          Change Password
        </h2>
        <form onSubmit={handlePasswordChange} className="space-y-4 max-w-md">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
              minLength={6}
              placeholder="At least 6 characters"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
              minLength={6}
              placeholder="Re-enter new password"
            />
          </div>
          {passwordError && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{passwordError}</p>}
          {passwordSuccess && (
            <p className="text-sm text-green-600 bg-green-50 p-3 rounded-lg flex items-center gap-2">
              <CheckCircle className="h-4 w-4" /> Password updated successfully
            </p>
          )}
          <button
            type="submit"
            disabled={passwordLoading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 text-sm font-medium"
          >
            {passwordLoading ? 'Updating...' : 'Update Password'}
          </button>
        </form>
      </section>

      {/* Two-Factor Authentication */}
      <section className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Smartphone className="h-5 w-5 text-gray-400" />
          Two-Factor Authentication (2FA)
        </h2>

        {mfaLoading ? (
          <p className="text-sm text-gray-500">Loading MFA status...</p>
        ) : mfaFactors.filter(f => f.status === 'verified').length > 0 ? (
          <div>
            <div className="flex items-center gap-2 mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
              <ShieldCheck className="h-5 w-5 text-green-600" />
              <span className="text-sm font-medium text-green-800">2FA is enabled</span>
            </div>
            {mfaFactors.filter(f => f.status === 'verified').map(factor => (
              <div key={factor.id} className="flex items-center justify-between py-2">
                <span className="text-sm text-gray-700">{factor.friendly_name || 'Authenticator App'}</span>
                <button
                  onClick={() => handleUnenrollMfa(factor.id)}
                  disabled={unenrolling}
                  className="px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50"
                >
                  {unenrolling ? 'Removing...' : 'Remove'}
                </button>
              </div>
            ))}
          </div>
        ) : !enrolling ? (
          <div>
            <div className="flex items-center gap-2 mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <ShieldOff className="h-5 w-5 text-amber-600" />
              <span className="text-sm font-medium text-amber-800">2FA is not enabled</span>
            </div>
            <p className="text-sm text-gray-500 mb-4">
              Add an extra layer of security by requiring a code from your authenticator app when signing in.
            </p>
            <button
              onClick={handleEnrollMfa}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
            >
              Enable 2FA
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {enrollData && (
              <>
                <p className="text-sm text-gray-700">Scan this QR code with your authenticator app (Google Authenticator, Authy, 1Password, etc.):</p>
                <div className="flex justify-center p-4 bg-white border border-gray-200 rounded-lg">
                  <img src={enrollData.qr} alt="MFA QR Code" className="w-48 h-48" />
                </div>
                <details className="text-xs text-gray-500">
                  <summary className="cursor-pointer hover:text-gray-700">Can't scan? Enter this code manually</summary>
                  <code className="block mt-2 p-2 bg-gray-100 rounded font-mono text-xs break-all">{enrollData.secret}</code>
                </details>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Enter the 6-digit code from your app</label>
                  <input
                    type="text"
                    value={verifyCode}
                    onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className="w-full max-w-[200px] px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-lg tracking-widest text-center"
                    placeholder="000000"
                    maxLength={6}
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={handleVerifyEnrollment}
                    disabled={verifyCode.length !== 6}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 text-sm font-medium"
                  >
                    Verify & Enable
                  </button>
                  <button
                    onClick={() => { setEnrolling(false); setEnrollData(null); setVerifyCode('') }}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {mfaError && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg mt-4">{mfaError}</p>}
        {mfaSuccess && (
          <p className="text-sm text-green-600 bg-green-50 p-3 rounded-lg mt-4 flex items-center gap-2">
            <CheckCircle className="h-4 w-4" /> {mfaSuccess}
          </p>
        )}
      </section>

      {/* Export Data */}
      <section className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-2 flex items-center gap-2">
          <Download className="h-5 w-5 text-gray-400" />
          Export Your Data
        </h2>
        <p className="text-sm text-gray-500 mb-4">
          Download all your organization data including projects, subcontractors, documents, and AI outputs.
        </p>
        <button
          onClick={handleExportData}
          disabled={exportLoading}
          className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 text-sm font-medium border border-gray-200"
        >
          {exportLoading ? 'Exporting...' : 'Download Data (JSON)'}
        </button>
      </section>

      {/* Delete Account */}
      <section className="bg-white rounded-xl border border-red-200 p-6">
        <h2 className="text-lg font-semibold text-red-700 mb-2 flex items-center gap-2">
          <Trash2 className="h-5 w-5 text-red-500" />
          Delete Account
        </h2>
        <p className="text-sm text-gray-600 mb-4">
          Permanently delete your account and all associated data. This action cannot be undone.
          Your subscription will be cancelled immediately.
        </p>
        <button
          onClick={() => setShowDeleteModal(true)}
          className="px-4 py-2 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 transition-colors text-sm font-medium border border-red-200"
        >
          Delete My Account
        </button>
      </section>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Delete Account</h3>
                <p className="text-sm text-gray-500">This action is permanent</p>
              </div>
            </div>

            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
              <p className="text-sm text-red-800">
                This will permanently delete:
              </p>
              <ul className="text-sm text-red-700 mt-2 space-y-1 list-disc list-inside">
                <li>Your user account and login credentials</li>
                <li>All projects, documents, and AI analysis outputs</li>
                <li>All subcontractor data and RFQ history</li>
                <li>Your Stripe subscription (cancelled immediately)</li>
              </ul>
            </div>

            <p className="text-sm text-gray-700 mb-3">
              Type <strong>DELETE MY ACCOUNT</strong> to confirm:
            </p>
            <input
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent mb-4"
              placeholder="DELETE MY ACCOUNT"
            />

            {deleteError && <p className="text-sm text-red-600 mb-4">{deleteError}</p>}

            <div className="flex gap-3">
              <button
                onClick={() => { setShowDeleteModal(false); setDeleteConfirmText(''); setDeleteError('') }}
                className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleteConfirmText !== 'DELETE MY ACCOUNT' || deleteLoading}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 text-sm font-medium"
              >
                {deleteLoading ? 'Deleting...' : 'Delete Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
