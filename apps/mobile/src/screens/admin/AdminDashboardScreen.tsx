import React from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { api } from '../../services/api';
import { useAuthStore } from '../../stores/authStore';
import { colors, tierColors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

interface DashboardStats {
  total_students: number;
  students_by_tier: Record<string, number>;
  inactive_7_days: number;
  new_this_week: number;
}

interface AdminUser {
  id: string;
  username: string;
  display_name: string;
  avatar_url?: string;
  tier: string;
  last_active_at?: string;
}

const TIER_LABELS: Record<string, string> = {
  free: 'FREE',
  FREE: 'FREE',
  core: 'CORE',
  SOA_CORE: 'CORE',
  wealth: 'WEALTH',
  SOA_WEALTH: 'WEALTH',
  bot: 'BOT',
  BOT_PRODUCT: 'BOT',
};

const TIER_COLOR_MAP: Record<string, string> = {
  free: tierColors.tierFree,
  FREE: tierColors.tierFree,
  core: tierColors.tierCore,
  SOA_CORE: tierColors.tierCore,
  wealth: tierColors.tierWealth,
  SOA_WEALTH: tierColors.tierWealth,
  bot: tierColors.tierBot,
  BOT_PRODUCT: tierColors.tierBot,
};

export function AdminDashboardScreen() {
  const { user } = useAuthStore();

  if (!(user as any)?.is_admin) {
    return (
      <View style={styles.accessDenied}>
        <Text style={styles.accessDeniedTitle}>Access Denied</Text>
        <Text style={styles.accessDeniedText}>
          You do not have permission to view this page.
        </Text>
      </View>
    );
  }

  return <AdminContent />;
}

function AdminContent() {
  const {
    data: stats,
    isLoading: statsLoading,
    refetch: refetchStats,
  } = useQuery<DashboardStats>({
    queryKey: ['admin', 'dashboard'],
    queryFn: async () => {
      const { data } = await api.get('/admin/dashboard');
      return data.stats ?? data;
    },
  });

  const {
    data: usersData,
    isLoading: usersLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch: refetchUsers,
    isRefetching,
  } = useInfiniteQuery({
    queryKey: ['admin', 'users'],
    queryFn: async ({ pageParam }: { pageParam?: string }) => {
      const params: Record<string, string> = { limit: '20' };
      if (pageParam) params.cursor = pageParam;
      const { data } = await api.get('/admin/users', { params });
      return data;
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage: any) => lastPage.nextCursor,
  });

  const users: AdminUser[] =
    usersData?.pages.flatMap((page: any) => page.users ?? []) ?? [];

  const isLoading = statsLoading || usersLoading;

  const handleRefresh = () => {
    refetchStats();
    refetchUsers();
  };

  const renderHeader = () => (
    <View>
      <View style={styles.header}>
        <Text style={styles.title}>Admin Dashboard</Text>
      </View>

      {statsLoading ? (
        <View style={styles.statsLoading}>
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      ) : stats ? (
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.total_students}</Text>
            <Text style={styles.statLabel}>Total Students</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: colors.warning }]}>
              {stats.inactive_7_days}
            </Text>
            <Text style={styles.statLabel}>Inactive 7+ Days</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: colors.primary }]}>
              {stats.new_this_week}
            </Text>
            <Text style={styles.statLabel}>New This Week</Text>
          </View>
          <View style={styles.statCard}>
            <View style={styles.tierBreakdown}>
              {stats.students_by_tier &&
                Object.entries(stats.students_by_tier).map(([tier, count]) => (
                  <View key={tier} style={styles.tierRow}>
                    <Text
                      style={[
                        styles.tierDot,
                        { color: TIER_COLOR_MAP[tier] ?? colors.textSecondary },
                      ]}
                    >
                      {TIER_LABELS[tier] ?? tier}
                    </Text>
                    <Text style={styles.tierCount}>{String(count)}</Text>
                  </View>
                ))}
            </View>
            <Text style={styles.statLabel}>By Tier</Text>
          </View>
        </View>
      ) : null}

      <View style={styles.usersHeader}>
        <Text style={styles.sectionTitle}>Users</Text>
      </View>
    </View>
  );

  const renderUser = ({ item }: { item: AdminUser }) => {
    const tierColor = TIER_COLOR_MAP[item.tier] ?? tierColors.tierFree;
    const tierLabel = TIER_LABELS[item.tier] ?? item.tier;
    const initial = item.display_name?.charAt(0)?.toUpperCase() ?? 'U';

    return (
      <View style={styles.userRow}>
        <View style={styles.userAvatar}>
          <Text style={styles.userAvatarText}>{initial}</Text>
        </View>
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{item.display_name}</Text>
          <Text style={styles.userUsername}>@{item.username}</Text>
        </View>
        <View style={styles.userMeta}>
          <View
            style={[styles.userTierBadge, { backgroundColor: tierColor + '20' }]}
          >
            <Text style={[styles.userTierText, { color: tierColor }]}>
              {tierLabel}
            </Text>
          </View>
          {item.last_active_at && (
            <Text style={styles.userLastActive}>
              {new Date(item.last_active_at).toLocaleDateString()}
            </Text>
          )}
        </View>
      </View>
    );
  };

  const renderFooter = () => {
    if (!isFetchingNextPage) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      data={users}
      renderItem={renderUser}
      keyExtractor={(item) => item.id}
      ListHeaderComponent={renderHeader}
      ListFooterComponent={renderFooter}
      contentContainerStyle={styles.listContent}
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={handleRefresh}
          tintColor={colors.primary}
        />
      }
      onEndReached={() => {
        if (hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      }}
      onEndReachedThreshold={0.3}
    />
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
  accessDenied: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xxl,
  },
  accessDeniedTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.danger,
    marginBottom: spacing.sm,
  },
  accessDeniedText: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: spacing.xxl,
    paddingBottom: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
  },
  statsLoading: {
    padding: spacing.xxxl,
    alignItems: 'center',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: spacing.lg,
    gap: spacing.md,
  },
  statCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.lg,
    width: '47%',
    minHeight: 90,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  statValue: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  tierBreakdown: {
    marginBottom: spacing.sm,
  },
  tierRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 3,
  },
  tierDot: {
    fontSize: 11,
    fontWeight: '600',
  },
  tierCount: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  usersHeader: {
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  listContent: {
    paddingBottom: 40,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  userAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceElevated,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  userAvatarText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.text,
  },
  userUsername: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  userMeta: {
    alignItems: 'flex-end',
  },
  userTierBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 8,
    marginBottom: 4,
  },
  userTierText: {
    fontSize: 10,
    fontWeight: '700',
  },
  userLastActive: {
    fontSize: 11,
    color: colors.textMuted,
  },
  footerLoader: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
});
