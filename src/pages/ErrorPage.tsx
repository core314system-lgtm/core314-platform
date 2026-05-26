import { AlertTriangle, RefreshCw, Home } from 'lucide-react'

export default function ErrorPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center">
        <div className="mx-auto w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mb-6">
          <AlertTriangle className="w-10 h-10 text-red-600" />
        </div>
        <h1 className="text-6xl font-bold text-gray-900 mb-2">500</h1>
        <h2 className="text-xl font-semibold text-gray-700 mb-4">Something went wrong</h2>
        <p className="text-gray-500 mb-8">
          An unexpected error occurred. Our team has been notified and we're working on it.
        </p>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => window.location.reload()}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            <RefreshCw className="w-4 h-4" />
            Reload Page
          </button>
          <a
            href="/dashboard"
            className="flex items-center gap-2 px-5 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50"
          >
            <Home className="w-4 h-4" />
            Go to Dashboard
          </a>
        </div>
        <p className="mt-8 text-xs text-gray-400">
          If this keeps happening, try clearing your browser cache or contact support.
        </p>
      </div>
    </div>
  )
}
