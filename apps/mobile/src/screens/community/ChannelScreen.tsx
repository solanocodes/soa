import React, { useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { api } from '../../services/api';
import { useSocket } from '../../hooks/useSocket';
import { MessageBubble, Message } from '../../components/chat/MessageBubble';
import { MessageInput } from '../../components/chat/MessageInput';
import type { CommunityStackParamList } from '../../navigation/CommunityStack';

type ChannelScreenRouteProp = RouteProp<CommunityStackParamList, 'Channel'>;
type ChannelScreenNavProp = NativeStackNavigationProp<CommunityStackParamList, 'Channel'>;

interface MessagesPage {
  messages: Message[];
  nextCursor: string | null;
}

export function ChannelScreen() {
  const route = useRoute<ChannelScreenRouteProp>();
  const navigation = useNavigation<ChannelScreenNavProp>();
  const { channelId, channelName } = route.params;
  const { socket } = useSocket();
  const queryClient = useQueryClient();
  const flatListRef = useRef<FlatList>(null);

  // Set header
  useEffect(() => {
    navigation.setOptions({
      headerTitle: channelName,
    });
  }, [navigation, channelName]);

  // Fetch messages with cursor-based pagination
  const {
    data,
    isLoading,
    isError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
  } = useInfiniteQuery<MessagesPage>({
    queryKey: ['messages', channelId],
    queryFn: async ({ pageParam }) => {
      const params: Record<string, string> = {};
      if (pageParam) params.cursor = pageParam as string;

      const { data } = await api.get(`/channels/${channelId}/messages`, {
        params,
      });
      return data;
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });

  // Socket.io: listen for new messages
  useEffect(() => {
    if (!socket) return;

    socket.emit('join_channel', channelId);

    const handleNewMessage = (message: Message) => {
      queryClient.setQueryData(
        ['messages', channelId],
        (oldData: any) => {
          if (!oldData) return oldData;
          const newPages = [...oldData.pages];
          newPages[0] = {
            ...newPages[0],
            messages: [message, ...newPages[0].messages],
          };
          return { ...oldData, pages: newPages };
        }
      );
    };

    socket.on('new_message', handleNewMessage);

    return () => {
      socket.emit('leave_channel', channelId);
      socket.off('new_message', handleNewMessage);
    };
  }, [socket, channelId, queryClient]);

  const messages = data?.pages.flatMap((page) => page.messages) ?? [];

  const handleSend = useCallback(
    async (content: string, imageUri?: string) => {
      try {
        const payload: Record<string, string> = {
          channel_id: channelId,
          content,
        };
        if (imageUri) {
          payload.image_url = imageUri;
        }
        await api.post('/messages', payload);
      } catch {
        // Error is handled silently — message won't appear via socket if it fails
      }
    },
    [channelId]
  );

  const handleLoadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const renderMessage = useCallback(
    ({ item }: { item: Message }) => <MessageBubble message={item} />,
    []
  );

  const renderFooter = useCallback(() => {
    if (!isFetchingNextPage) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  }, [isFetchingNextPage]);

  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          {/* Loading skeleton */}
          {[1, 2, 3, 4, 5].map((i) => (
            <View key={i} style={styles.skeletonRow}>
              <View style={styles.skeletonAvatar} />
              <View style={styles.skeletonContent}>
                <View style={styles.skeletonName} />
                <View style={styles.skeletonText} />
              </View>
            </View>
          ))}
        </View>
      </View>
    );
  }

  if (isError) {
    return (
      <View style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="cloud-offline-outline" size={48} color={colors.textSecondary} />
          <Text style={styles.errorText}>Failed to load messages</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => refetch()}>
            <Text style={styles.retryText}>Tap to retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {messages.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="chatbubble-outline" size={48} color={colors.textMuted} />
          <Text style={styles.emptyText}>No messages yet</Text>
          <Text style={styles.emptySubtext}>Be the first to send a message!</Text>
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          inverted
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.3}
          ListFooterComponent={renderFooter}
          contentContainerStyle={styles.messageList}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}

      <MessageInput onSend={handleSend} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    padding: spacing.lg,
  },
  skeletonRow: {
    flexDirection: 'row',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  skeletonAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceElevated,
    marginRight: spacing.md,
  },
  skeletonContent: {
    flex: 1,
    gap: spacing.sm,
  },
  skeletonName: {
    width: 100,
    height: 14,
    borderRadius: 4,
    backgroundColor: colors.surfaceElevated,
  },
  skeletonText: {
    width: '70%',
    height: 14,
    borderRadius: 4,
    backgroundColor: colors.surfaceElevated,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xxl,
  },
  errorText: {
    fontSize: 16,
    color: colors.text,
    marginTop: spacing.lg,
    fontWeight: '600',
  },
  retryButton: {
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  retryText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '500',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xxl,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginTop: spacing.lg,
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  messageList: {
    paddingVertical: spacing.sm,
  },
  separator: {
    height: spacing.xs,
  },
  footerLoader: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
});
