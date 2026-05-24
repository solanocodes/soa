import React, { useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { useChannel } from '@/src/hooks/useChannels';
import { useMessages } from '@/src/hooks/useMessages';
import { useAuth } from '@/src/hooks/useAuth';
import { useSocketStore } from '@/src/store/socketStore';
import { MessageBubble } from '@/src/components/MessageBubble';
import { MessageComposer } from '@/src/components/MessageComposer';
import { LoadingScreen } from '@/src/components/LoadingScreen';
import { EmptyState } from '@/src/components/EmptyState';
import { uploadApi } from '@/src/api/client';
import { Message } from '@/src/types';
import { colors, spacing, typography, borderRadius } from '@/src/constants/theme';

export default function ChannelScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const flatListRef = useRef<FlatList>(null);

  const { data: channel, isLoading: channelLoading } = useChannel(slug);
  const {
    messages,
    isLoading: messagesLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    sendMessage,
    isSending,
    react,
  } = useMessages(channel?.id || '');

  const typingUsers = useSocketStore(
    (s) => (channel?.id ? s.typingUsers[channel.id] || [] : [])
  );

  const handleSend = async (content: string, attachments?: string[]) => {
    sendMessage({ content, attachments });
  };

  const handleImagePress = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
        allowsMultipleSelection: false,
      });

      if (!result.canceled && result.assets[0]) {
        const formData = new FormData();
        const asset = result.assets[0];
        formData.append('image', {
          uri: asset.uri,
          type: 'image/jpeg',
          name: 'upload.jpg',
        } as any);

        const { data } = await uploadApi.uploadImage(formData);
        sendMessage({ content: '', attachments: [data.url] });
      }
    } catch (err) {
      // Silently handle image picker errors
    }
  };

  const handleReact = (messageId: string, emoji: string) => {
    react({ messageId, emoji });
  };

  const loadMore = () => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  };

  if (channelLoading || (messagesLoading && !messages.length)) {
    return <LoadingScreen />;
  }

  const renderMessage = ({ item }: { item: Message }) => (
    <MessageBubble
      message={item}
      onReact={handleReact}
      currentUserId={user?.id}
    />
  );

  const renderFooter = () => {
    if (!isFetchingNextPage) return null;
    return (
      <View style={styles.loadingMore}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backIcon}>{'<'}</Text>
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.channelName}>
            {channel?.emoji} {channel?.name || slug}
          </Text>
          {channel?.memberCount != null && (
            <Text style={styles.memberCount}>
              {channel.memberCount} members
            </Text>
          )}
        </View>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        {messages.length === 0 ? (
          <EmptyState
            icon="💬"
            title="No messages yet"
            message="Be the first to say something!"
          />
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            renderItem={renderMessage}
            keyExtractor={(item) => item.id}
            inverted
            contentContainerStyle={styles.messageList}
            onEndReached={loadMore}
            onEndReachedThreshold={0.3}
            ListFooterComponent={renderFooter}
            showsVerticalScrollIndicator={false}
          />
        )}

        <MessageComposer
          onSend={handleSend}
          onImagePress={handleImagePress}
          isSending={isSending}
          typingUsers={typingUsers}
          placeholder={`Message #${channel?.name || slug}`}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  backButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceElevated,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  backIcon: {
    fontSize: typography.sizes.lg,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  headerInfo: {
    flex: 1,
  },
  channelName: {
    fontSize: typography.sizes.lg,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  memberCount: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
    marginTop: 1,
  },
  messageList: {
    paddingVertical: spacing.sm,
  },
  loadingMore: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
});
