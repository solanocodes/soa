import { useInfiniteQuery, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { journalApi } from '@/src/api/client';
import { JournalEntry } from '@/src/types';

export function useJournal() {
  const queryClient = useQueryClient();

  const entriesQuery = useInfiniteQuery({
    queryKey: ['journal'],
    queryFn: async ({ pageParam = 1 }) => {
      const { data } = await journalApi.list(pageParam, 20);
      return data;
    },
    getNextPageParam: (lastPage) => {
      if (lastPage.hasMore) return lastPage.page + 1;
      return undefined;
    },
    initialPageParam: 1,
  });

  const statsQuery = useQuery({
    queryKey: ['journal', 'stats'],
    queryFn: async () => {
      const { data } = await journalApi.stats();
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: Partial<JournalEntry>) => journalApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['journal'] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<JournalEntry> }) =>
      journalApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['journal'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => journalApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['journal'] });
    },
  });

  const allEntries = entriesQuery.data?.pages.flatMap((page) => page.data) || [];

  return {
    entries: allEntries,
    stats: statsQuery.data,
    isLoading: entriesQuery.isLoading,
    isStatsLoading: statsQuery.isLoading,
    isError: entriesQuery.isError,
    error: entriesQuery.error,
    fetchNextPage: entriesQuery.fetchNextPage,
    hasNextPage: entriesQuery.hasNextPage,
    isFetchingNextPage: entriesQuery.isFetchingNextPage,
    createEntry: createMutation.mutate,
    isCreating: createMutation.isPending,
    updateEntry: updateMutation.mutate,
    deleteEntry: deleteMutation.mutate,
    refetch: entriesQuery.refetch,
  };
}
