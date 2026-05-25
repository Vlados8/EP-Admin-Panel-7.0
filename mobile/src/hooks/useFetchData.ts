import { useQuery, UseQueryOptions, UseQueryResult } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { AxiosError } from 'axios';

interface ApiResponse<T> {
  status: 'success' | 'error';
  data: T;
  message?: string;
}

/**
 * A highly reusable, type-safe custom hook for making GET requests using the Axios apiClient
 * and TanStack React Query v5.
 *
 * @param queryKey The unique cache key array for React Query
 * @param url The relative API path (e.g. '/chat/conversations')
 * @param options Additional options to customize the query behavior (e.g. refetchInterval, enabled, etc.)
 */
export function useFetchData<TData, TError = AxiosError>(
  queryKey: any[],
  url: string,
  options?: Omit<UseQueryOptions<ApiResponse<TData>, TError>, 'queryKey' | 'queryFn'>
): UseQueryResult<ApiResponse<TData>, TError> {
  return useQuery<ApiResponse<TData>, TError>({
    queryKey,
    queryFn: async () => {
      const response = await apiClient.get<ApiResponse<TData>>(url);
      return response.data;
    },
    ...options,
  });
}
