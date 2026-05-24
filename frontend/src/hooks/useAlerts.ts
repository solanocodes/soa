import { useInfiniteQuery } from '@tanstack/react-query';
import { alertsApi } from '@/src/api/client';

export function useAlerts(category?: string) {
  const alertsQuery = useInfiniteQuery({
    queryKey: ['alerts', category],
    queryFn: async ({ pageParam = 1 }) => {
      const { data } = await alertsApi.list(category, pageParam, 30);
      return data;
    },
    getNextPageParam: (lastPage) => {
      if (lastPage.hasMore) return lastPage.page + 1;
      return undefined;
    },
    initialPageParam: 1,
  });

  const allAlerts = alertsQuery.data?.pages.flatMap((page) => page.data) || [];

  return {
    alerts: allAlerts,
    isLoading: alertsQuery.isLoading,
    isError: alertsQuery.isError,
    error: alertsQuery.error,
    fetchNextPage: alertsQuery.fetchNextPage,
    hasNextPage: alertsQuery.hasNextPage,
    isFetchingNextPage: alertsQuery.isFetchingNextPage,
    refetch: alertsQuery.refetch,
  };
}
