import { StrictMode, useEffect, useMemo } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider, createRouter } from '@tanstack/react-router'
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useApi } from '@/hooks/useApi';
import { routeTree } from './routeTree.gen';
import type { CallApi } from '@/types/api.ts';

import { initApiClient } from '@/lib/api-client'
import './index.css'

// initApiClient()

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            refetchOnWindowFocus: false,
        },
    },
});

export interface MyRouterContext {
    queryClient: QueryClient;
    callApi: CallApi;
}

function App() {
    const { callApi } = useApi();

    const router = useMemo(
        () =>
            createRouter({
                routeTree,
                context: {
                    queryClient,
                    callApi,
                },
                defaultPreload: 'intent',
                defaultPreloadStaleTime: 0,
            }),
        [callApi],
    );

    useEffect(() => {
        router.update({
            context: {
                queryClient,
                callApi,
            },
        });
    }, [router, callApi]);

    return (
        <QueryClientProvider client={queryClient}>
            <RouterProvider router={router} />
        </QueryClientProvider>
    );
}

// Register the router instance for type safety
declare module "@tanstack/react-router" {
    interface Register {
        router: ReturnType<typeof createRouter>;
    }
}

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <App />
    </StrictMode>,
)
