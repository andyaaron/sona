import { configureApiClient } from '@sona/api-client'

import { env } from '@/config/env'

export function initApiClient() {
  configureApiClient({
    baseUrl: env.apiUrl,
    getToken: () => null,
    onUnauthorized: () => {
      window.location.href = '/auth/login';
    },
  })
}
