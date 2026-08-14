import { createContext, useContext } from 'react';
import type { User } from '@/types/user.ts';

/**
 * Made this custom context hook because we initialize user context as undefined.
 * By using this, we don't have to check for undefined since we know the context
 * won't be undefined. An error will be thrown if the context is not provided.
 */
export const UserContext = createContext<User | undefined>(undefined);
export function useUser() {
    const context = useContext(UserContext);

    if (!context) {
        throw new Error('useUser must be used within a UserProvider');
    }

    return context;
}
