import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import * as Sentry from '@sentry/react'
import './index.css'
import App from './App.tsx'
import { validateEnv } from './lib/validateEnv'

if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.MODE,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: false,
        blockAllMedia: false,
      }),
    ],
    tracesSampleRate: 1.0,
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
  })
}

try {
  validateEnv();
  
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
} catch (error) {
  const root = document.getElementById('root');
  if (root) {
    root.innerHTML = `
      <div style="
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        max-width: 800px;
        margin: 50px auto;
        padding: 40px;
        background: #fff;
        border-radius: 8px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      ">
        <div style="
          background: #fee;
          border-left: 4px solid #c00;
          padding: 20px;
          margin-bottom: 20px;
          border-radius: 4px;
        ">
          <h1 style="margin: 0 0 10px 0; color: #c00; font-size: 24px;">
            ⚠️ Configuration Error
          </h1>
          <p style="margin: 0; color: #666; font-size: 14px;">
            The Core314 Admin application cannot start due to missing configuration.
          </p>
        </div>
        
        <div style="
          background: #f5f5f5;
          padding: 20px;
          border-radius: 4px;
          margin-bottom: 20px;
          font-family: 'Courier New', monospace;
          font-size: 13px;
          line-height: 1.6;
          white-space: pre-wrap;
          overflow-x: auto;
        ">${error instanceof Error ? error.message : String(error)}</div>
        
        <div style="padding: 20px; background: #f9f9f9; border-radius: 4px;">
          <h2 style="margin: 0 0 15px 0; font-size: 18px; color: #333;">
            For Administrators
          </h2>
          <p style="margin: 0 0 10px 0; color: #666; line-height: 1.6;">
            This error occurs when required environment variables are not configured in Netlify.
            Please follow these steps to resolve:
          </p>
          <ol style="margin: 10px 0; padding-left: 20px; color: #666; line-height: 1.8;">
            <li>Go to <a href="https://app.netlify.com/sites/core314-admin/configuration/env" target="_blank" style="color: #0066cc;">Netlify Environment Variables</a></li>
            <li>Add the required <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> variables</li>
            <li>Trigger a new deployment</li>
          </ol>
          <p style="margin: 15px 0 0 0; padding: 10px; background: #fff3cd; border-left: 3px solid #ffc107; color: #856404; font-size: 13px;">
            <strong>Note:</strong> This safeguard prevents the application from showing a blank white screen.
            Once the environment variables are configured, the application will start normally.
          </p>
        </div>
      </div>
    `;
  }
  
  console.error('❌ Application failed to start:', error);
}
