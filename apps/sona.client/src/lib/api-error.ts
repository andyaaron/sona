import { ApiError } from '@sona/api-client'

/**
 * User-facing message for a failed request: the server's `{ error }` body when
 * it sent one, otherwise the status. Shared by every route/feature that toasts.
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    const body = error.body as Record<string, unknown> | null
    if (body && typeof body.error === 'string') return body.error
    return `Request failed (${error.status})`
  }
  return error instanceof Error && error.message ? error.message : 'An unexpected error occurred'
}
