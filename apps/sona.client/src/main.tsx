import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider, createRouter } from '@tanstack/react-router'
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { routeTree } from './routeTree.gen';
import { initApiClient } from '@/lib/api-client'

import './index.css'

export interface MyRouterContext {
  queryClient: QueryClient;
}

initApiClient()

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            refetchOnWindowFocus: false,
        },
    },
});

const router = createRouter({
    routeTree,
    context: {
        queryClient,
    },
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 0,
});

// Register the router instance for type safety
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

function App() {
    return (
        <QueryClientProvider client={queryClient}>
            <RouterProvider router={router} />
        </QueryClientProvider>
    );
}

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <App />
    </StrictMode>,
)
