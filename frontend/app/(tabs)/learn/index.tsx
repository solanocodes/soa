import React from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Image,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { coursesApi } from '@/src/api/client';
import { useAuth } from '@/src/hooks/useAuth';
import { TierBadge } from '@/src/components/TierBadge';
import { LockedContent } from '@/src/components/LockedContent';
import { LoadingScreen } from '@/src/components/LoadingScreen';
import { EmptyState } from '@/src/components/EmptyState';
import { Course, Tier } from '@/src/types';
import { colors, spacing, typography, borderRadius } from '@/src/constants/theme';

const TIER_RANK: Record<Tier, number> = { FREE: 0, CORE: 1, WEALTH: 2, BOT: 3 };

export default function LearnScreen() {
  const { user } = useAuth();
  const [refreshing, setRefreshing] = React.useState(false);

  const coursesQuery = useQuery({
    queryKey: ['courses'],
    queryFn: async () => {
      const { data } = await coursesApi.list();
      return data;
    },
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await coursesQuery.refetch();
    setRefreshing(false);
  };

  if (coursesQuery.isLoading && !refreshing) {
    return <LoadingScreen />;
  }

  const userTierRank = user ? TIER_RANK[user.tier] : 0;

  const renderCourse = ({ item }: { item: Course }) => {
    const isLocked = TIER_RANK[item.tier] > userTierRank;
    const progress = item.progress || 0;
    const totalModules = item.modules.length;
    const completedModules = item.modules.filter((m) => m.isCompleted).length;

    return (
      <TouchableOpacity
        style={styles.courseCard}
        activeOpacity={isLocked ? 1 : 0.7}
        disabled={isLocked}
      >
        {/* Thumbnail */}
        <View style={styles.thumbnailContainer}>
          {item.thumbnail ? (
            <Image source={{ uri: item.thumbnail }} style={styles.thumbnail} resizeMode="cover" />
          ) : (
            <View style={[styles.thumbnail, styles.thumbnailPlaceholder]}>
              <Text style={styles.thumbnailIcon}>▶️</Text>
            </View>
          )}
          {progress > 0 && progress < 100 && (
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${progress}%` }]} />
            </View>
          )}
          {progress >= 100 && (
            <View style={styles.completedBadge}>
              <Text style={styles.completedText}>✓ Complete</Text>
            </View>
          )}
        </View>

        {/* Info */}
        <View style={styles.courseInfo}>
          <View style={styles.courseHeader}>
            <Text style={styles.courseTitle} numberOfLines={2}>
              {item.title}
            </Text>
            <TierBadge tier={item.tier} />
          </View>
          <Text style={styles.courseDescription} numberOfLines={2}>
            {item.description}
          </Text>
          <View style={styles.courseMeta}>
            <Text style={styles.metaText}>
              {completedModules}/{totalModules} modules
            </Text>
            <Text style={styles.metaDivider}>|</Text>
            <Text style={styles.metaText}>
              {Math.round(item.totalDuration / 60)} min
            </Text>
            <Text style={styles.metaDivider}>|</Text>
            <Text style={styles.metaText}>
              {item.enrolledCount} enrolled
            </Text>
          </View>
        </View>

        {/* Lock overlay */}
        {isLocked && <LockedContent requiredTier={item.tier} />}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Learn</Text>
        <Text style={styles.subtitle}>Master options trading</Text>
      </View>

      {coursesQuery.isError ? (
        <EmptyState
          icon="⚠️"
          title="Failed to load courses"
          message="Pull down to retry"
        />
      ) : (
        <FlatList
          data={coursesQuery.data || []}
          renderItem={renderCourse}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <EmptyState
              icon="📚"
              title="No courses available"
              message="Check back soon for new content"
            />
          }
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    fontSize: typography.sizes.title,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  list: {
    padding: spacing.lg,
    gap: spacing.lg,
    paddingBottom: 40,
  },
  courseCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  thumbnailContainer: {
    position: 'relative',
  },
  thumbnail: {
    width: '100%',
    height: 160,
    backgroundColor: colors.surfaceElevated,
  },
  thumbnailPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  thumbnailIcon: {
    fontSize: 40,
  },
  progressBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: colors.border,
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
  },
  completedBadge: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    backgroundColor: colors.primaryDim,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  completedText: {
    fontSize: typography.sizes.xs,
    fontWeight: '700',
    color: colors.primary,
  },
  courseInfo: {
    padding: spacing.lg,
  },
  courseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  courseTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: '700',
    color: colors.textPrimary,
    flex: 1,
  },
  courseDescription: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  courseMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaText: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
  },
  metaDivider: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
    marginHorizontal: spacing.sm,
  },
});
