import React, { useCallback } from 'react';
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
  author?: { username: string; display_name: string | null; avatar_url?: string };
}

interface WinsResponse {
  wins: Win[];
  total?: number;
  nextCursor?: string;
}

export function WinsWallScreen() {
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    refetch,
    isRefetching,
  } = useInfiniteQuery({
    queryKey: ['wins'],
    queryFn: async ({ pageParam }: { pageParam?: string }) => {
      const res = await api.get<WinsResponse>('/wins', {
        params: { cursor: pageParam, limit: 20 },
      });
      return res.data;
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });

  const wins = data?.pages.flatMap((page) => page.wins) ?? [];
  const totalCount = data?.pages[0]?.total;

  const renderWin = useCallback(({ item }: { item: Win }) => {
    const authorName =
      item.original_author_name ??
      item.author?.display_name ??
      item.author?.username ??
      'Student';
    const initial = authorName.charAt(0).toUpperCase();

    return (
      <View style={[styles.winCard, item.is_verified && styles.verifiedCard]}>
        <View style={styles.winHeader}>
          <View style={styles.authorRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initial}</Text>
            </View>
            <View style={styles.headerInfo}>
              <View style={styles.nameRow}>
                <Text style={styles.authorName}>{authorName}</Text>
                {item.is_verified && (
                  <View style={styles.verifiedBadge}>
                    <Text style={styles.verifiedIcon}>✓</Text>
                  </View>
                )}
              </View>
              <Text style={styles.timestamp}>
                {new Date(item.created_at).toLocaleDateString()}
              </Text>
            </View>
          </View>
        </View>

        {item.pnl_amount != null && (
          <View style={styles.pnlContainer}>
            <Text
              style={[
                styles.pnl,
                { color: item.pnl_amount >= 0 ? colors.primary : colors.danger },
              ]}
            >
              {item.pnl_amount >= 0 ? '+' : ''}$
              {Math.abs(item.pnl_amount).toLocaleString()}
            </Text>
          </View>
        )}

        {item.caption && <Text style={styles.caption}>{item.caption}</Text>}

        {item.screenshot_url && (
          <Image
            source={{ uri: item.screenshot_url }}
            style={styles.screenshot}
            resizeMode="contain"
          />
        )}
      </View>
    );
  }, []);

  const renderFooter = () => {
    if (!isFetchingNextPage) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  };

  const renderEmpty = () => {
    if (isLoading) return null;
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No wins yet</Text>
        <Text style={styles.emptySubtext}>
          Student wins will appear here
        </Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Student Wins</Text>
        {totalCount != null && (
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{totalCount}</Text>
          </View>
        )}
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : isError ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Failed to load wins</Text>
          <Text style={styles.emptySubtext}>Pull down to try again</Text>
        </View>
      ) : (
        <FlatList
          data={wins}
          renderItem={renderWin}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          onEndReached={() => {
            if (hasNextPage && !isFetchingNextPage) {
              fetchNextPage();
            }
          }}
          onEndReachedThreshold={0.3}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={colors.primary}
            />
          }
          ListFooterComponent={renderFooter}
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: spacing.xxl,
    paddingBottom: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
  },
  countBadge: {
    marginLeft: spacing.sm,
    backgroundColor: colors.primaryDim,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: 10,
  },
  countText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
  list: {
    padding: spacing.lg,
  },
  winCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: colors.border,
  },
  verifiedCard: {
    borderLeftColor: colors.gold,
  },
  winHeader: {
    marginBottom: spacing.sm,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
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
  },
  authorName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginRight: spacing.xs,
  },
  verifiedBadge: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  verifiedIcon: {
    fontSize: 10,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  timestamp: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  pnlContainer: {
    marginBottom: spacing.sm,
  },
  pnl: {
    fontSize: 22,
    fontWeight: '700',
  },
  caption: {
    fontSize: 15,
    color: colors.text,
    lineHeight: 22,
    marginBottom: spacing.sm,
  },
  screenshot: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    marginTop: spacing.sm,
  },
  footerLoader: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
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
