import { useState } from 'react'
import { Mail, Clock, CheckCircle, AlertTriangle, Send, Loader2 } from 'lucide-react'

interface Props {
  taskOrderId: string
}

interface FollowUpResult {
  sow_subcontractor_id: string
  subcontractor_name: string
  email: string
  days_since_rfq: number
  follow_up_number: number
  action: 'sent' | 'skipped' | 'error'
  reason?: string
}

export default function FollowUpManager({ taskOrderId }: Props) {
  const [running, setRunning] = useState(false)
  const [results, setResults] = useState<FollowUpResult[] | null>(null)
  const [dryRunResults, setDryRunResults] = useState<FollowUpResult[] | null>(null)

  async function runFollowUps(dryRun: boolean) {
    setRunning(true)
    try {
      const resp = await fetch('/.netlify/functions/rfq-followup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task_order_id: taskOrderId, dry_run: dryRun }),
      })
      const data = await resp.json()
      if (dryRun) {
        setDryRunResults(data.results || [])
      } else {
        setResults(data.results || [])
        setDryRunResults(null)
      }
    } catch (err) {
      alert('Follow-up check failed: ' + (err instanceof Error ? err.message : 'Unknown error'))
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Mail size={18} className="text-blue-600" />
          <h3 className="font-semibold text-gray-900">RFQ Follow-Up Manager</h3>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => runFollowUps(true)}
            disabled={running}
            className="text-xs px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700 disabled:opacity-50"
          >
            {running ? <Loader2 size={12} className="animate-spin" /> : 'Preview'}
          </button>
          <button
            onClick={() => runFollowUps(false)}
            disabled={running}
            className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1"
          >
            <Send size={12} /> Send Follow-Ups
          </button>
        </div>
      </div>

      <p className="text-xs text-gray-500 mb-3">
        Automatically sends reminders to subcontractors who haven&apos;t responded to RFQs.
        Cadence: Day 3 (gentle reminder), Day 7 (second reminder), Day 10 (final notice).
      </p>

      {/* Dry Run Preview */}
      {dryRunResults && dryRunResults.length > 0 && (
        <div className="border border-yellow-200 bg-yellow-50 rounded-lg p-3 mb-3">
          <p className="text-xs font-medium text-yellow-800 mb-2">Preview — {dryRunResults.length} follow-ups would be sent:</p>
          <div className="space-y-1">
            {dryRunResults.map((r, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <span className="text-gray-700">{r.subcontractor_name}</span>
                <span className="text-gray-500">Day {r.days_since_rfq} • Follow-up #{r.follow_up_number}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {dryRunResults && dryRunResults.length === 0 && (
        <div className="text-xs text-gray-500 italic p-3 bg-gray-50 rounded-lg">
          <CheckCircle size={12} className="inline mr-1 text-green-500" />
          No follow-ups needed — all subs have either responded or aren&apos;t due yet.
        </div>
      )}

      {/* Actual Results */}
      {results && results.length > 0 && (
        <div className="border border-gray-200 rounded-lg divide-y divide-gray-100">
          {results.map((r, i) => (
            <div key={i} className="flex items-center justify-between p-2.5 text-xs">
              <div className="flex items-center gap-2">
                {r.action === 'sent' ? <CheckCircle size={14} className="text-green-500" /> :
                 r.action === 'error' ? <AlertTriangle size={14} className="text-red-500" /> :
                 <Clock size={14} className="text-gray-400" />}
                <div>
                  <span className="font-medium text-gray-900">{r.subcontractor_name}</span>
                  <span className="text-gray-400 ml-2">{r.email}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-1.5 py-0.5 rounded ${
                  r.action === 'sent' ? 'bg-green-50 text-green-700' :
                  r.action === 'error' ? 'bg-red-50 text-red-700' :
                  'bg-gray-50 text-gray-600'
                }`}>
                  {r.action === 'sent' ? `Sent #${r.follow_up_number}` :
                   r.action === 'error' ? 'Error' :
                   r.reason || 'Skipped'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {results && results.length === 0 && (
        <div className="text-xs text-gray-500 italic p-3 bg-gray-50 rounded-lg">
          No pending follow-ups for this project.
        </div>
      )}
    </div>
  )
}
