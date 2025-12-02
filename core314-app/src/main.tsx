import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import * as Sentry from '@sentry/react'
import './index.css'
import App from './App.tsx'

if (import.meta.env.SENTRY_DSN_APP) {
  Sentry.init({
    dsn: import.meta.env.SENTRY_DSN_APP,
    environment: import.meta.env.SENTRY_ENVIRONMENT || 'beta-test',
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: false,
        blockAllMedia: false,
      }),
      Sentry.captureConsoleIntegration({ levels: ['error'] }),
    ],
    tracesSampleRate: 0.2, // 20% sampling to reduce volume during beta
    replaysSessionSampleRate: 0.1, // 10% of sessions
    replaysOnErrorSampleRate: 1.0, // 100% of error sessions
  })
  
  Sentry.setTag('app', 'core314-app')
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Sentry.ErrorBoundary fallback={<ErrorFallback />} showDialog>
      <App />
    </Sentry.ErrorBoundary>
  </StrictMode>,
)

function ErrorFallback() {
  return (
    <div style={{
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      maxWidth: '600px',
      margin: '100px auto',
      padding: '40px',
      background: '#fff',
      borderRadius: '8px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
      textAlign: 'center',
    }}>
      <h1 style={{ color: '#c00', marginBottom: '20px' }}>⚠️ Something went wrong</h1>
      <p style={{ color: '#666', marginBottom: '20px' }}>
        We've been notified and are working on a fix. Please try refreshing the page.
      </p>
      <button
        onClick={() => window.location.reload()}
        style={{
          background: '#0066cc',
          color: '#fff',
          border: 'none',
          padding: '12px 24px',
          borderRadius: '4px',
          cursor: 'pointer',
          fontSize: '16px',
        }}
      >
        Refresh Page
      </button>
    </div>
  )
}
