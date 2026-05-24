import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRoute } from '@react-navigation/native';
import { api } from '../../services/api';
import { useAuthStore } from '../../stores/authStore';
import { useSocket } from '../../hooks/useSocket';
import { MessageInput } from '../../components/chat/MessageInput';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

interface DM {
  id: string;
  thread_id: string;
  sender_id: string;
  content: string;
  is_ai_generated: boolean;
  ai_confidence: number | null;
  is_read: boolean;
  created_at: string;
  sender?: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
}

export function DMChatScreen() {
  const route = useRoute<any>();
  const { threadId, otherUserName } = route.params;
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const { socket } = useSocket();

  const { data, fetchNextPage, hasNextPage, isLoading } = useInfiniteQuery({
    queryKey: ['dm-messages', threadId],
    queryFn: async ({ pageParam }) => {
      const res = await api.get(`/dms/threads/${threadId}/messages`, {
        params: { cursor: pageParam, limit: 30 },
      });
      return res.data;
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage: any) => lastPage.nextCursor,
  });

  const sendMutation = useMutation({
    mutationFn: async (content: string) => {
      const res = await api.post(`/dms/threads/${threadId}/messages`, { content });
      return res.data.message;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dm-messages', threadId] });
    },
  });

  const messages = data?.pages.flatMap((page: any) => page.messages) ?? [];

  const handleSend = useCallback((content: string) => {
    sendMutation.mutate(content);
  }, [sendMutation]);

  const renderMessage = ({ item }: { item: DM }) => {
    const isMe = item.sender_id === user?.id;
    const name = item.sender?.display_name || item.sender?.username || otherUserName;

    return (
      <View style={[styles.messageBubble, isMe ? styles.myMessage : styles.theirMessage]}>
        {!isMe && <Text style={styles.senderName}>{name}</Text>}
        <Text style={styles.messageContent}>{item.content}</Text>
        <View style={styles.messageFooter}>
          {item.is_ai_generated && (
            <View style={styles.aiBadge}>
              <Text style={styles.aiBadgeText}>AI</Text>
            </View>
          )}
          <Text style={styles.messageTime}>
            {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
      </View>
    );
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      <FlatList
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        inverted
        contentContainerStyle={styles.list}
        onEndReached={() => hasNextPage && fetchNextPage()}
        onEndReachedThreshold={0.3}
      />
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
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  list: {
    padding: spacing.lg,
    gap: spacing.sm,
  },
  messageBubble: {
    maxWidth: '80%',
    padding: spacing.md,
    borderRadius: 12,
    marginBottom: spacing.xs,
  },
  myMessage: {
    alignSelf: 'flex-end',
    backgroundColor: colors.primary + '20',
    borderBottomRightRadius: 4,
  },
  theirMessage: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surface,
    borderBottomLeftRadius: 4,
  },
  senderName: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
    marginBottom: 2,
  },
  messageContent: {
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  aiBadge: {
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
  },
  aiBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  messageTime: {
    fontSize: 11,
    color: colors.textMuted,
  },
});
