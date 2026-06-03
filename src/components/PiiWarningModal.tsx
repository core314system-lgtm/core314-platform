import { AlertTriangle, Shield, X } from 'lucide-react'
import type { PiiMatch } from '../lib/piiDetector'

interface PiiWarningModalProps {
  matches: PiiMatch[]
  onProceed: () => void
  onCancel: () => void
}

export default function PiiWarningModal({ matches, onProceed, onCancel }: PiiWarningModalProps) {
  const totalCount = matches.reduce((s, m) => s + m.count, 0)

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        {/* Header */}
        <div className="bg-amber-50 border-b border-amber-200 px-6 py-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center shrink-0">
            <AlertTriangle size={20} className="text-amber-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">Personal Information Detected</h3>
            <p className="text-sm text-amber-700">{totalCount} potential PII item{totalCount !== 1 ? 's' : ''} found in your documents</p>
          </div>
          <button onClick={onCancel} className="ml-auto p-1.5 text-gray-400 hover:text-gray-600 rounded-lg">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-4 space-y-4">
          <p className="text-sm text-gray-600">
            The following types of personal information were detected in the documents being sent to AI analysis.
            This data will be transmitted to OpenAI for processing.
          </p>

          <div className="space-y-2">
            {matches.map(m => (
              <div key={m.type} className="flex items-start gap-3 bg-gray-50 rounded-lg p-3">
                <Shield size={16} className="text-amber-500 mt-0.5 shrink-0" />
                <div>
                  <div className="text-sm font-medium text-gray-900">{m.label} <span className="text-gray-400">({m.count})</span></div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {m.examples.join(', ')}
                    {m.count > 3 && <span className="text-gray-400"> + {m.count - 3} more</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800">
            <strong>Data Processing:</strong> Document text is sent to OpenAI via API for analysis. OpenAI does not use API data
            for model training and retains it for up to 30 days for abuse monitoring (zero-retention available).
            All data is encrypted in transit (TLS 1.2+). See our{' '}
            <a href="/ai-data-processing" target="_blank" rel="noreferrer" className="underline font-medium">AI Data Processing</a> page for full details.
          </div>
        </div>

        {/* Actions */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onProceed}
            className="px-4 py-2 text-sm font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700 transition-colors"
          >
            Proceed with Analysis
          </button>
        </div>
      </div>
    </div>
  )
}
