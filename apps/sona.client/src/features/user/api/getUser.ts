import { queryOptions } from "@tanstack/react-query";
import type { CallApi } from '@/types/api.ts';
import type { User } from '@/types/user';

export async function getCurrentUser(callApi: CallApi): Promise<User | null> {
    return callApi('/api/user');
}

export const userQueryOptions = (callApi: CallApi) =>
    queryOptions<User>({
        queryKey: ['currentUser'],
        queryFn: async () => {
            const data = await getCurrentUser(callApi);
            if (!data) {
                throw new Error('No data returned from API');
            }
            return data;
        },
        staleTime: Infinity, // User profile rarely changes
    });
