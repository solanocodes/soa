import React, { useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import { api } from '../../services/api';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

interface Thread {
  id: string;
  other_user: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
  last_message: {
    content: string;
    created_at: string;
  } | null;
  unread_count: number;
}

function getRelativeTime(dateString: string): string {
  const now = new Date();
  const date = new Date(dateString);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffMin < 1) return 'now';
  if (diffMin < 60) return `${diffMin}m`;
  if (diffHour < 24) return `${diffHour}h`;
  if (diffDay < 7) return `${diffDay}d`;
  return date.toLocaleDateString();
}

export function DMListScreen() {
  const navigation = useNavigation<any>();

  const {
    data: threads,
    isLoading,
    isError,
    refetch,
    isRefetching,
  } = useQuery<Thread[]>({
    queryKey: ['dm-threads'],
    queryFn: async () => {
      const res = await api.get('/dms/threads');
      return res.data.threads ?? res.data ?? [];
    },
  });

  const handleThreadPress = useCallback(
    (thread: Thread) => {
      const name = thread.other_user.display_name || thread.other_user.username;
      navigation.navigate('DMChat', {
        threadId: thread.id,
        otherUserName: name,
      });
    },
    [navigation]
  );

  const renderThread = useCallback(
    ({ item }: { item: Thread }) => {
      const name = item.other_user.display_name || item.other_user.username;
      const initial = name?.[0]?.toUpperCase() || '?';
      const hasUnread = item.unread_count > 0;

      return (
        <TouchableOpacity
          style={styles.threadRow}
          onPress={() => handleThreadPress(item)}
          activeOpacity={0.7}
        >
          <View style={styles.avatarContainer}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initial}</Text>
            </View>
            {hasUnread && <View style={styles.unreadDot} />}
          </View>

          <View style={styles.threadInfo}>
            <View style={styles.threadHeader}>
              <Text
                style={[styles.name, hasUnread && styles.nameUnread]}
                numberOfLines={1}
              >
                {name}
              </Text>
              {item.last_message && (
                <Text style={styles.time}>
                  {getRelativeTime(item.last_message.created_at)}
                </Text>
              )}
            </View>
            {item.last_message && (
              <Text
                style={[styles.preview, hasUnread && styles.previewUnread]}
                numberOfLines={1}
              >
                {item.last_message.content}
              </Text>
            )}
          </View>
        </TouchableOpacity>
      );
    },
    [handleThreadPress]
  );

  const renderEmpty = () => {
    if (isLoading) return null;
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No messages yet</Text>
        <Text style={styles.emptySubtext}>
          Your conversations will appear here
        </Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Messages</Text>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : isError ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Failed to load messages</Text>
          <Text style={styles.emptySubtext}>Pull down to try again</Text>
        </View>
      ) : (
        <FlatList
          data={threads}
          renderItem={renderThread}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={renderEmpty}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: spacing.xxl,
    paddingBottom: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  threadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: spacing.md,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surfaceElevated,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: colors.text,
    fontWeight: '600',
    fontSize: 16,
  },
  unreadDot: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.background,
  },
  threadInfo: {
    flex: 1,
  },
  threadHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  name: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.text,
    flex: 1,
    marginRight: spacing.sm,
  },
  nameUnread: {
    fontWeight: '700',
  },
  time: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  preview: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  previewUnread: {
    color: colors.text,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xxl,
    paddingTop: 80,
  },
  emptyText: {
    fontSize: 18,
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
