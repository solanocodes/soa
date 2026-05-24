import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { channelsApi } from '@/src/api/client';
import { Channel } from '@/src/types';

export function useChannels() {
  const queryClient = useQueryClient();

  const channelsQuery = useQuery({
    queryKey: ['channels'],
    queryFn: async () => {
      const { data } = await channelsApi.list();
      return data;
    },
  });

  const joinChannelMutation = useMutation({
    mutationFn: (channelId: string) => channelsApi.join(channelId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['channels'] });
    },
  });

  const leaveChannelMutation = useMutation({
    mutationFn: (channelId: string) => channelsApi.leave(channelId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['channels'] });
    },
  });

  const groupedChannels = channelsQuery.data?.reduce(
    (acc: Record<string, Channel[]>, channel: Channel) => {
      const category = channel.category || 'General';
      if (!acc[category]) acc[category] = [];
      acc[category].push(channel);
      return acc;
    },
    {} as Record<string, Channel[]>
  );

  return {
    channels: channelsQuery.data || [],
    groupedChannels: groupedChannels || {},
    isLoading: channelsQuery.isLoading,
    isError: channelsQuery.isError,
    error: channelsQuery.error,
    refetch: channelsQuery.refetch,
    joinChannel: joinChannelMutation.mutate,
    leaveChannel: leaveChannelMutation.mutate,
  };
}

export function useChannel(slug: string) {
  return useQuery({
    queryKey: ['channel', slug],
    queryFn: async () => {
      const { data } = await channelsApi.getBySlug(slug);
      return data;
    },
    enabled: !!slug,
  });
}
