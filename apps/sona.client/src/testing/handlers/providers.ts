import { HttpResponse, http } from 'msw'

export const providerHandlers = [http.get('/api/providers', () => HttpResponse.json([]))]
