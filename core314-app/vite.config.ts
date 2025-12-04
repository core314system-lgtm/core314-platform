import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import { sentryVitePlugin } from "@sentry/vite-plugin"

export default defineConfig({
  plugins: [
    react(),
    sentryVitePlugin({
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,
      disable: !process.env.SENTRY_AUTH_TOKEN,
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  define: {
    'import.meta.env.SENTRY_DSN_APP': JSON.stringify(process.env.SENTRY_DSN_APP),
    'import.meta.env.SENTRY_ENVIRONMENT': JSON.stringify(process.env.SENTRY_ENVIRONMENT || 'beta-test'),
    'import.meta.env.VITE_COMMIT_REF': JSON.stringify(process.env.COMMIT_REF || process.env.NETLIFY_COMMIT_REF || 'unknown'),
    'import.meta.env.VITE_DEPLOY_ID': JSON.stringify(process.env.DEPLOY_ID || 'local'),
    'import.meta.env.VITE_CONTEXT': JSON.stringify(process.env.CONTEXT || 'development'),
  },
  build: {
    sourcemap: true,
  },
})

