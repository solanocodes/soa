import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useJournal } from '@/src/hooks/useJournal';
import { JournalEntryCard } from '@/src/components/JournalEntryCard';
import { StatsCard } from '@/src/components/StatsCard';
import { LoadingScreen } from '@/src/components/LoadingScreen';
import { EmptyState } from '@/src/components/EmptyState';
import { JournalEntry } from '@/src/types';
import { colors, spacing, typography, borderRadius } from '@/src/constants/theme';

export default function JournalScreen() {
  const router = useRouter();
  const {
    entries,
    stats,
    isLoading,
    isStatsLoading,
    isError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
  } = useJournal();

  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const loadMore = () => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  };

  if (isLoading && !refreshing) {
    return <LoadingScreen />;
  }

  const renderEntry = ({ item }: { item: JournalEntry }) => (
    <JournalEntryCard entry={item} />
  );

  const renderHeader = () => (
    <View style={styles.statsRow}>
      <StatsCard
        icon="🎯"
        label="Win Rate"
        value={stats ? `${stats.winRate.toFixed(0)}%` : '--'}
        color={colors.primary}
      />
      <StatsCard
        icon="💰"
        label="Total P&L"
        value={
          stats
            ? `${stats.totalPnL >= 0 ? '+' : ''}$${Math.abs(stats.totalPnL).toFixed(0)}`
            : '--'
        }
        color={stats && stats.totalPnL >= 0 ? colors.primary : colors.danger}
      />
      <StatsCard
        icon="🔥"
        label="Streak"
        value={stats ? `${stats.currentStreak}` : '--'}
        color={colors.warning}
      />
    </View>
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
        <View>
          <Text style={styles.title}>Trade Journal</Text>
          <Text style={styles.subtitle}>Track your progress</Text>
        </View>
      </View>

      {isError ? (
        <EmptyState
          icon="⚠️"
          title="Failed to load journal"
          message="Pull down to retry"
        />
      ) : (
        <FlatList
          data={entries}
          renderItem={renderEntry}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={renderHeader}
          ListEmptyComponent={
            <EmptyState
              icon="📓"
              title="No trades logged"
              message="Start journaling your trades to track your growth"
            />
          }
          contentContainerStyle={styles.list}
          onEndReached={loadMore}
          onEndReachedThreshold={0.3}
          ListFooterComponent={renderFooter}
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

      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/(tabs)/journal/new')}
        activeOpacity={0.8}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  list: {
    paddingBottom: 100,
  },
  loadingMore: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  fabText: {
    fontSize: 28,
    fontWeight: '600',
    color: colors.background,
    marginTop: -2,
  },
});
