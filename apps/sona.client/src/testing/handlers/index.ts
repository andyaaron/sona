import { notificationHandlers } from './notifications'
import { opieHandlers } from './opie'
import { organizationHandlers } from './organizations'
import { patientHandlers } from './patients'
import { providerHandlers } from './providers'
import { userHandlers } from './users'

/**
 * Default happy-path handlers for every endpoint in @sona/api-client. Each
 * returns @sona/shared-typed fixtures against the seeded org; tests override
 * with `server.use(...)` for the case under test.
 */
export const handlers = [
  ...userHandlers,
  ...organizationHandlers,
  ...patientHandlers,
  ...providerHandlers,
  ...notificationHandlers,
  ...opieHandlers,
]
