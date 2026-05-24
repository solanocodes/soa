import React from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../services/api';
import { useAuthStore } from '../../stores/authStore';
import { colors, tierColors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

const TIER_LEVELS: Record<string, number> = {
  free: 0,
  core: 1,
  wealth: 2,
  bot: 3,
};

const TIER_LABELS: Record<string, string> = {
  free: 'FREE',
  core: 'SOA CORE',
  wealth: 'SOA WEALTH',
  bot: 'BOT PRODUCT',
};

const TIER_COLOR_MAP: Record<string, string> = {
  free: tierColors.tierFree,
  core: tierColors.tierCore,
  wealth: tierColors.tierWealth,
  bot: tierColors.tierBot,
};

interface Course {
  id: string;
  title: string;
  description: string;
  required_tier: string;
  thumbnail_url?: string;
}

export function CourseListScreen() {
  const { user } = useAuthStore();
  const userTierLevel = TIER_LEVELS[user?.tier ?? 'free'] ?? 0;

  const {
    data: courses,
    isLoading,
    isError,
    refetch,
    isRefetching,
  } = useQuery<Course[]>({
    queryKey: ['courses'],
    queryFn: async () => {
      const { data } = await api.get('/courses');
      return data.courses ?? data ?? [];
    },
  });

  const isLocked = (requiredTier: string): boolean => {
    const requiredLevel = TIER_LEVELS[requiredTier] ?? 0;
    return userTierLevel < requiredLevel;
  };

  const renderCourse = ({ item }: { item: Course }) => {
    const locked = isLocked(item.required_tier);
    const tierLabel = TIER_LABELS[item.required_tier] ?? item.required_tier;
    const tierColor =
      TIER_COLOR_MAP[item.required_tier] ?? tierColors.tierFree;

    return (
      <View style={[styles.courseCard, locked && styles.courseCardLocked]}>
        <View style={styles.courseHeader}>
          <Text
            style={[styles.courseTitle, locked && styles.lockedText]}
            numberOfLines={2}
          >
            {item.title}
          </Text>
          <View
            style={[styles.tierBadge, { backgroundColor: tierColor + '20' }]}
          >
            <Text style={[styles.tierBadgeText, { color: tierColor }]}>
              {tierLabel}
            </Text>
          </View>
        </View>

        <Text
          style={[styles.courseDescription, locked && styles.lockedText]}
          numberOfLines={3}
        >
          {item.description}
        </Text>

        {locked && (
          <View style={styles.lockOverlay}>
            <Text style={styles.lockIcon}>🔒</Text>
            <Text style={styles.lockText}>Upgrade to unlock</Text>
          </View>
        )}
      </View>
    );
  };

  const renderEmpty = () => {
    if (isLoading) return null;
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>Courses coming soon</Text>
        <Text style={styles.emptySubtext}>
          Educational content will be available here
        </Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Learn</Text>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : isError ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Failed to load courses</Text>
          <Text style={styles.emptySubtext}>Pull down to try again</Text>
        </View>
      ) : (
        <FlatList
          data={courses}
          renderItem={renderCourse}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
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
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: spacing.lg,
  },
  courseCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  courseCardLocked: {
    opacity: 0.7,
  },
  courseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  courseTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.text,
    flex: 1,
    marginRight: spacing.sm,
  },
  courseDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  tierBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: 10,
  },
  tierBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  lockedText: {
    color: colors.textMuted,
  },
  lockOverlay: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  lockIcon: {
    fontSize: 14,
    marginRight: spacing.sm,
  },
  lockText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.warning,
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
