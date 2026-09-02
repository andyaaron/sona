import path from 'node:path'

import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// Deliberately not merged with vite.config.ts: that file exports the ASP.NET dev
// certificate as a side effect, which has no place in a unit-test run (or CI).
// Keep the `@/` alias in sync with it.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    environmentOptions: {
      // Matches the api-client baseUrl in src/testing/setup.ts so MSW's
      // relative handler paths resolve against the same origin.
      jsdom: { url: 'http://localhost' },
    },
    setupFiles: ['./src/testing/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    css: false,
    coverage: {
      reporter: ['text', 'lcov'],
      reportsDirectory: 'coverage',
    },
  },
})
