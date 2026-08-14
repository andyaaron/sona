import { useCallback } from 'react';
import type { CallApi } from '@/types/api.ts';

class ApiError extends Error {
  details?: string;
  location?: string;
  constructor(message: string, details?: string, location?: string) {
    super(message);
    this.details = details;
    this.location = location;
  }
}

export const useApi = () => {
  const callApi: CallApi = useCallback(
    async <T>(endpoint: string, options: RequestInit = {}): Promise<T> => {
        

      // 2. Execute the fetch
      const response = await fetch(endpoint, {
        ...options,
      });

      // Check for 401
      if (response.status === 401) {
        console.warn('Unauthorized! Redirect to MS Identity...');

        window.location.href = '/auth/login';
        return new Promise(() => {});
      }

      if (!response.ok) {
        // 2. Check the Content-Type to see if it's actually JSON
        //   mainly for handling a server error in dev
        const contentType = response.headers.get('content-type');

        if (contentType && contentType.includes('application/json')) {
          const errorData = await response.json();
          throw new ApiError(
            errorData.error || errorData.title ||
              errorData.message ||
              'API Error',
            errorData.details,
            errorData.location,
          );
        } else {
          const errorText = await response.text();
          console.error('Server error: ', errorText);
          throw new Error(`Server error: ${errorText}`);
        }
      }

      // Handle 204 no content (PUT requests)
      if (response.status === 204) {
        return null as unknown as T;
      }

      return response.json();
    },
    [],
  );

  return { callApi };
};
