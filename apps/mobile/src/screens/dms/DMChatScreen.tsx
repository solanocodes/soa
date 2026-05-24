import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRoute, useNavigation } from '@react-navigation/native';
import { api } from '../../services/api';
import { useAuthStore } from '../../stores/authStore';
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

interface MessagesResponse {
  messages: DM[];
  nextCursor?: string;
}

export function DMChatScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation();
  const { threadId, otherUserName } = route.params;
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [messageText, setMessageText] = useState('');
  const flatListRef = useRef<FlatList>(null);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = useInfiniteQuery({
    queryKey: ['dm-messages', threadId],
    queryFn: async ({ pageParam }: { pageParam?: string }) => {
      const res = await api.get<MessagesResponse>(
        `/dms/threads/${threadId}/messages`,
        { params: { cursor: pageParam, limit: 30 } }
      );
      return res.data;
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });

  const sendMutation = useMutation({
    mutationFn: async (content: string) => {
      const res = await api.post(`/dms/threads/${threadId}/messages`, { content });
      return res.data.message;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dm-messages', threadId] });
      queryClient.invalidateQueries({ queryKey: ['dm-threads'] });
    },
  });

  const messages = data?.pages.flatMap((page) => page.messages) ?? [];

  const handleSend = useCallback(() => {
    const text = messageText.trim();
    if (!text || sendMutation.isPending) return;
    setMessageText('');
    sendMutation.mutate(text);
  }, [messageText, sendMutation]);

  const renderMessage = useCallback(
    ({ item }: { item: DM }) => {
      const isMe = item.sender_id === user?.id;

      return (
        <View
          style={[
            styles.messageBubbleContainer,
            isMe ? styles.messageBubbleRight : styles.messageBubbleLeft,
          ]}
        >
          <View
            style={[
              styles.messageBubble,
              isMe ? styles.myBubble : styles.theirBubble,
            ]}
          >
            <Text
              style={[
                styles.messageText,
                isMe ? styles.myMessageText : styles.theirMessageText,
              ]}
            >
              {item.content}
            </Text>
            {item.is_ai_generated && (
              <View style={styles.aiBadge}>
                <Text style={styles.aiBadgeText}>AI</Text>
              </View>
            )}
          </View>
          <Text style={styles.messageTime}>
            {new Date(item.created_at).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
        </View>
      );
    },
    [user?.id]
  );

  const renderFooter = () => {
    if (!isFetchingNextPage) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Text style={styles.backText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {otherUserName}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Messages */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          inverted
          contentContainerStyle={styles.messagesContent}
          onEndReached={() => {
            if (hasNextPage && !isFetchingNextPage) {
              fetchNextPage();
            }
          }}
          onEndReachedThreshold={0.3}
          ListFooterComponent={renderFooter}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No messages yet</Text>
              <Text style={styles.emptySubtext}>
                Send a message to start the conversation
              </Text>
            </View>
          }
        />
      )}

      {/* Input */}
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.textInput}
          placeholder="Type a message..."
          placeholderTextColor={colors.textMuted}
          value={messageText}
          onChangeText={setMessageText}
          multiline
          maxLength={2000}
        />
        <TouchableOpacity
          style={[
            styles.sendButton,
            (!messageText.trim() || sendMutation.isPending) &&
              styles.sendButtonDisabled,
          ]}
          onPress={handleSend}
          disabled={!messageText.trim() || sendMutation.isPending}
          activeOpacity={0.7}
        >
          <Text style={styles.sendButtonText}>
            {sendMutation.isPending ? '...' : '↑'}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backText: {
    fontSize: 28,
    color: colors.primary,
    fontWeight: '300',
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 36,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  messagesContent: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  messageBubbleContainer: {
    marginBottom: spacing.md,
    maxWidth: '80%',
  },
  messageBubbleRight: {
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
  },
  messageBubbleLeft: {
    alignSelf: 'flex-start',
    alignItems: 'flex-start',
  },
  messageBubble: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: 18,
  },
  myBubble: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: 4,
  },
  theirBubble: {
    backgroundColor: colors.surfaceElevated,
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 21,
  },
  myMessageText: {
    color: '#000000',
  },
  theirMessageText: {
    color: colors.text,
  },
  aiBadge: {
    marginTop: 4,
    alignSelf: 'flex-end',
    backgroundColor: colors.surface,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  aiBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 0.5,
  },
  messageTime: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  textInput: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 20,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: 15,
    color: colors.text,
    maxHeight: 100,
    marginRight: spacing.sm,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: colors.surfaceElevated,
  },
  sendButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  footerLoader: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 80,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
