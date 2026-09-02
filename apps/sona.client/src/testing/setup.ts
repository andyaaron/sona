import '@testing-library/jest-dom/vitest'

import { cleanup } from '@testing-library/react'
import { afterAll, afterEach, beforeAll } from 'vitest'

import { configureApiClient } from '@sona/api-client'

import { server } from './server'

// sonner reads the reduced-motion media query; jsdom has no matchMedia.
if (typeof window.matchMedia !== 'function') {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList
}

// TanStack Router's scroll restoration calls scrollTo, which jsdom does not implement.
window.scrollTo = () => {}

beforeAll(() => {
  // Absolute base so fetch() has a URL to resolve against in jsdom; MSW handlers
  // use relative paths, resolved against the same origin (vitest.config.ts).
  configureApiClient({ baseUrl: 'http://localhost', getToken: () => null })
  // An unmocked call is a test bug, not a silent 404.
  server.listen({ onUnhandledRequest: 'error' })
})

afterEach(() => {
  cleanup()
  server.resetHandlers()
  window.localStorage.clear()
})

afterAll(() => server.close())
