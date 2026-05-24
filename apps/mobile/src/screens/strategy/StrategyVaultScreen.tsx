import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useInfiniteQuery } from '@tanstack/react-query';
import { api } from '../../services/api';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { Ionicons } from '@expo/vector-icons';

const SETUP_TYPES = [
  'All',
  'VWAP reclaim',
  'Orderblock',
  'Trend continuation',
  'ATH caution',
  'Reversal',
  'Morning range',
  'Key level test',
];

interface Alert {
  id: string;
  content: string;
  ticker: string | null;
  direction: string | null;
  alert_type: string;
  created_at: string;
  has_image: boolean;
  image_url: string | null;
}

export function StrategyVaultScreen() {
  const [searchText, setSearchText] = useState('');
  const [selectedSetup, setSelectedSetup] = useState('All');

  const { data, fetchNextPage, hasNextPage, isLoading } = useInfiniteQuery({
    queryKey: ['strategy-vault', searchText, selectedSetup],
    queryFn: async ({ pageParam }) => {
      const params: any = { cursor: pageParam, limit: 20, is_historical: true };
      if (searchText) params.ticker = searchText.toUpperCase();
      if (selectedSetup !== 'All') params.setup_type = selectedSetup;
      const res = await api.get('/alerts', { params });
      return res.data;
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage: any) => lastPage.nextCursor,
  });

  const alerts = data?.pages.flatMap((page: any) => page.alerts) ?? [];

  const renderAlert = ({ item }: { item: Alert }) => (
    <View style={styles.alertCard}>
      <View style={styles.alertHeader}>
        {item.ticker && (
          <View style={styles.tickerBadge}>
            <Text style={styles.tickerText}>{item.ticker}</Text>
          </View>
        )}
        {item.direction && (
          <Text style={[styles.direction, item.direction === 'long' ? styles.long : styles.short]}>
            {item.direction.toUpperCase()}
          </Text>
        )}
        <Text style={styles.date}>{new Date(item.created_at).toLocaleDateString()}</Text>
      </View>
      <Text style={styles.alertContent} numberOfLines={4}>{item.content}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Strategy Vault</Text>
      <Text style={styles.subtitle}>Search historical alerts by ticker or setup</Text>

      <View style={styles.searchRow}>
        <Ionicons name="search" size={18} color={colors.textSecondary} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search ticker (NQ, ES, SPY...)"
          placeholderTextColor={colors.textMuted}
          value={searchText}
          onChangeText={setSearchText}
          autoCapitalize="characters"
        />
      </View>

      <FlatList
        horizontal
        data={SETUP_TYPES}
        keyExtractor={(item) => item}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.setupPill, selectedSetup === item && styles.setupPillActive]}
            onPress={() => setSelectedSetup(item)}
          >
            <Text style={[styles.setupPillText, selectedSetup === item && styles.setupPillTextActive]}>
              {item}
            </Text>
          </TouchableOpacity>
        )}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.setupRow}
        style={styles.setupList}
      />

      {isLoading ? (
        <ActivityIndicator color={colors.primary} size="large" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={alerts}
          renderItem={renderAlert}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          onEndReached={() => hasNextPage && fetchNextPage()}
          onEndReachedThreshold={0.3}
          ListEmptyComponent={
            <Text style={styles.emptyText}>
              {searchText ? `No alerts found for "${searchText}"` : 'Search for alerts above'}
            </Text>
          }
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
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  subtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    marginHorizontal: spacing.lg,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    paddingVertical: spacing.md,
    marginLeft: spacing.sm,
  },
  setupList: {
    maxHeight: 44,
    marginTop: spacing.md,
  },
  setupRow: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  setupPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  setupPillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  setupPillText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  setupPillTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  list: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  alertCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.lg,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  alertHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  tickerBadge: {
    backgroundColor: colors.primaryDim,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 4,
  },
  tickerText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  direction: {
    fontSize: 11,
    fontWeight: '600',
  },
  long: {
    color: colors.primary,
  },
  short: {
    color: colors.danger,
  },
  date: {
    fontSize: 11,
    color: colors.textMuted,
    marginLeft: 'auto',
  },
  alertContent: {
    fontSize: 13,
    color: colors.text,
    lineHeight: 19,
  },
  emptyText: {
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 40,
    fontSize: 14,
  },
});
