import React from 'react';
import {
  View,
  Text,
  FlatList,
  Image,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useInfiniteQuery } from '@tanstack/react-query';
import { api } from '../../services/api';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { Ionicons } from '@expo/vector-icons';

interface Win {
  id: string;
  user_id: string | null;
  caption: string | null;
  screenshot_url: string | null;
  win_type: string;
  pnl_amount: number | null;
  is_verified: boolean;
  is_historical: boolean;
  original_author_name: string | null;
  created_at: string;
  author?: { username: string; display_name: string | null };
}

export function WinsWallScreen() {
  const { data, fetchNextPage, hasNextPage, isLoading, refetch, isRefetching } = useInfiniteQuery({
    queryKey: ['wins'],
    queryFn: async ({ pageParam }) => {
      const res = await api.get('/wins', { params: { cursor: pageParam, limit: 20 } });
      return res.data;
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage: any) => lastPage.nextCursor,
  });

  const wins = data?.pages.flatMap((page: any) => page.wins) ?? [];

  const renderWin = ({ item }: { item: Win }) => {
    const authorName = item.author?.display_name || item.author?.username || item.original_author_name || 'Student';

    return (
      <View style={[styles.winCard, item.is_verified && styles.verifiedCard]}>
        <View style={styles.winHeader}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{authorName[0]?.toUpperCase()}</Text>
          </View>
          <View style={styles.headerInfo}>
            <View style={styles.nameRow}>
              <Text style={styles.authorName}>{authorName}</Text>
              {item.is_verified && (
                <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
              )}
            </View>
            <Text style={styles.timestamp}>
              {new Date(item.created_at).toLocaleDateString()}
            </Text>
          </View>
          {item.pnl_amount && (
            <Text style={styles.pnl}>+${item.pnl_amount.toLocaleString()}</Text>
          )}
        </View>

        {item.caption && <Text style={styles.caption}>{item.caption}</Text>}

        {item.screenshot_url && (
          <Image source={{ uri: item.screenshot_url }} style={styles.screenshot} resizeMode="cover" />
        )}

        <View style={styles.winTypeBadge}>
          <Text style={styles.winTypeText}>{item.win_type.replace('_', ' ')}</Text>
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
    <View style={styles.container}>
      <Text style={styles.header}>Student Wins</Text>
      <FlatList
        data={wins}
        renderItem={renderWin}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        onEndReached={() => hasNextPage && fetchNextPage()}
        onEndReachedThreshold={0.3}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />
        }
        ListEmptyComponent={
          <Text style={styles.emptyText}>No wins posted yet</Text>
        }
      />
    </View>
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
  header: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
    padding: spacing.lg,
    paddingBottom: spacing.sm,
  },
  list: {
    padding: spacing.lg,
    paddingTop: spacing.sm,
    gap: spacing.md,
  },
  winCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  verifiedCard: {
    borderColor: colors.gold,
    borderLeftWidth: 3,
  },
  winHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceElevated,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  avatarText: {
    color: colors.text,
    fontWeight: '600',
    fontSize: 14,
  },
  headerInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  authorName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  timestamp: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  pnl: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary,
  },
  caption: {
    fontSize: 14,
    color: colors.text,
    marginBottom: spacing.sm,
    lineHeight: 20,
  },
  screenshot: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    marginBottom: spacing.sm,
  },
  winTypeBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primaryDim,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 10,
  },
  winTypeText: {
    fontSize: 11,
    color: colors.primary,
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  emptyText: {
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 40,
    fontSize: 15,
  },
});
