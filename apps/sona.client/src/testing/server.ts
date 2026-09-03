import { setupServer } from 'msw/node'

import { handlers } from './handlers'

/** One MSW server for the whole run; tests override per case with `server.use(...)`. */
export const server = setupServer(...handlers)
