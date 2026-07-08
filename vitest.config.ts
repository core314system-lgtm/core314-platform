import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    env: {
      VITE_SUPABASE_URL: 'https://placeholder.invalid',
      VITE_SUPABASE_ANON_KEY: 'placeholder_anon_key',
      SUPABASE_URL: 'https://placeholder.invalid',
      SUPABASE_SERVICE_ROLE_KEY: 'placeholder_service_key',
    },
    include: ['src/**/*.{test,spec}.{ts,tsx}', 'netlify/**/*.{test,spec}.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/lib/**', 'src/hooks/**', 'netlify/functions/_shared/**'],
    },
  },
})
