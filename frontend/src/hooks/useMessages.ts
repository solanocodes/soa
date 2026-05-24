import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { useEffect, useCallback } from 'react';
import { messagesApi } from '@/src/api/client';
import { useSocketStore } from '@/src/store/socketStore';
import { Message } from '@/src/types';

export function useMessages(channelId: string) {
  const queryClient = useQueryClient();
  const { onNewMessage, offNewMessage, joinChannel, leaveChannel } = useSocketStore();

  const messagesQuery = useInfiniteQuery({
    queryKey: ['messages', channelId],
    queryFn: async ({ pageParam = 1 }) => {
      const { data } = await messagesApi.list(channelId, pageParam, 50);
      return data;
    },
    getNextPageParam: (lastPage) => {
      if (lastPage.hasMore) return lastPage.page + 1;
      return undefined;
    },
    initialPageParam: 1,
    enabled: !!channelId,
  });

  // Join channel and listen for new messages
  useEffect(() => {
    if (!channelId) return;

    joinChannel(channelId);

    const handleNewMessage = (message: Message) => {
      if (message.channelId === channelId) {
        queryClient.setQueryData(['messages', channelId], (old: any) => {
          if (!old) return old;
          const firstPage = old.pages[0];
          return {
            ...old,
            pages: [
              { ...firstPage, data: [message, ...firstPage.data] },
              ...old.pages.slice(1),
            ],
          };
        });
      }
    };

    onNewMessage(handleNewMessage);

    return () => {
      leaveChannel(channelId);
      offNewMessage();
    };
  }, [channelId]);

  const sendMessageMutation = useMutation({
    mutationFn: ({ content, attachments }: { content: string; attachments?: string[] }) =>
      messagesApi.send(channelId, content, attachments),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', channelId] });
    },
  });

  const reactMutation = useMutation({
    mutationFn: ({ messageId, emoji }: { messageId: string; emoji: string }) =>
      messagesApi.react(messageId, emoji),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', channelId] });
    },
  });

  const allMessages =
    messagesQuery.data?.pages.flatMap((page) => page.data) || [];

  return {
    messages: allMessages,
    isLoading: messagesQuery.isLoading,
    isError: messagesQuery.isError,
    error: messagesQuery.error,
    fetchNextPage: messagesQuery.fetchNextPage,
    hasNextPage: messagesQuery.hasNextPage,
    isFetchingNextPage: messagesQuery.isFetchingNextPage,
    sendMessage: sendMessageMutation.mutate,
    isSending: sendMessageMutation.isPending,
    react: reactMutation.mutate,
  };
}
