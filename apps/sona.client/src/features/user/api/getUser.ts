import { queryOptions } from "@tanstack/react-query";
import { apiFetch } from '@sona/api-client';
import type { User } from '@sona/shared';

export const userQueryOptions = queryOptions({
    queryKey: ['currentUser'],
    queryFn: () => apiFetch<User>('/api/user'),
    staleTime: Infinity, // User profile rarely changes
});
