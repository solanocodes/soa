import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import { useAuthStore } from '../../stores/authStore';
import { useSocket } from '../../hooks/useSocket';
import { AlertCard, Alert } from '../../components/alerts/AlertCard';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

const TIER_LEVELS: Record<string, number> = {
  free: 0,
  core: 1,
  wealth: 2,
  bot: 3,
};

interface FilterTab {
  label: string;
  slug: string | null;
  minTier?: string;
}

const FILTER_TABS: FilterTab[] = [
  { label: 'All', slug: null },
  { label: 'Solano', slug: 'solano-alerts' },
  { label: 'Demon', slug: 'demon-alerts' },
  { label: 'Bryce', slug: 'bryce-alerts' },
  { label: 'Options', slug: 'options-alerts', minTier: 'wealth' },
  { label: 'Bot', slug: 'bot-feed', minTier: 'bot' },
];

interface AlertsResponse {
  alerts: Alert[];
  nextCursor?: string;
}

export function AlertsFeedScreen() {
  const { user } = useAuthStore();
  const { socket } = useSocket();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [showNewBanner, setShowNewBanner] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const isScrolledDown = useRef(false);

  const userTierLevel = TIER_LEVELS[user?.tier ?? 'free'] ?? 0;

  const visibleTabs = FILTER_TABS.filter((tab) => {
    if (!tab.minTier) return true;
    return userTierLevel >= (TIER_LEVELS[tab.minTier] ?? 0);
  });

  const fetchAlerts = async ({ pageParam }: { pageParam?: string }) => {
    const params: Record<string, string> = { limit: '20' };
    if (activeTab) params.channel_slug = activeTab;
    if (pageParam) params.cursor = pageParam;

    const { data } = await api.get<AlertsResponse>('/alerts', { params });
    return data;
  };

  const {
    data,
    isLoading,
    isError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
    isRefetching,
  } = useInfiniteQuery({
    queryKey: ['alerts', activeTab],
    queryFn: fetchAlerts,
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });

  const alerts = data?.pages.flatMap((page) => page.alerts) ?? [];

  // Socket listener for new alerts
  useEffect(() => {
    if (!socket) return;

    const handleNewAlert = () => {
      if (isScrolledDown.current) {
        setShowNewBanner(true);
      } else {
        queryClient.invalidateQueries({ queryKey: ['alerts', activeTab] });
      }
    };

    socket.on('new_alert', handleNewAlert);
    return () => {
      socket.off('new_alert', handleNewAlert);
    };
  }, [socket, activeTab, queryClient]);

  const handleNewBannerPress = useCallback(() => {
    setShowNewBanner(false);
    queryClient.invalidateQueries({ queryKey: ['alerts', activeTab] });
    flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
  }, [activeTab, queryClient]);

  const handleScroll = useCallback(
    (event: { nativeEvent: { contentOffset: { y: number } } }) => {
      isScrolledDown.current = event.nativeEvent.contentOffset.y > 200;
    },
    []
  );

  const handleTabPress = useCallback((slug: string | null) => {
    setActiveTab(slug);
    setShowNewBanner(false);
  }, []);

  const renderAlert = useCallback(
    ({ item }: { item: Alert }) => <AlertCard alert={item} />,
    []
  );

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
        <Text style={styles.emptyText}>No alerts yet</Text>
        <Text style={styles.emptySubtext}>
          Trade alerts will appear here in real-time
        </Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Alerts</Text>
      </View>

      {/* Filter Tabs */}
      <View style={styles.tabsContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsContent}
        >
          {visibleTabs.map((tab) => (
            <TouchableOpacity
              key={tab.label}
              style={[
                styles.tab,
                activeTab === tab.slug && styles.tabActive,
              ]}
              onPress={() => handleTabPress(tab.slug)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.tabText,
                  activeTab === tab.slug && styles.tabTextActive,
                ]}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* New Alerts Banner */}
      {showNewBanner && (
        <TouchableOpacity
          style={styles.newBanner}
          onPress={handleNewBannerPress}
          activeOpacity={0.8}
        >
          <Text style={styles.newBannerText}>New alerts available</Text>
        </TouchableOpacity>
      )}

      {/* Content */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : isError ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Failed to load alerts</Text>
          <Text style={styles.emptySubtext}>Pull down to try again</Text>
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={alerts}
          renderItem={renderAlert}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          onScroll={handleScroll}
          scrollEventThrottle={100}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={colors.primary}
            />
          }
          onEndReached={() => {
            if (hasNextPage && !isFetchingNextPage) {
              fetchNextPage();
            }
          }}
          onEndReachedThreshold={0.3}
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
  tabsContainer: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tabsContent: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  tab: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 20,
    backgroundColor: colors.surface,
    marginRight: spacing.sm,
  },
  tabActive: {
    backgroundColor: colors.primary,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  tabTextActive: {
    color: '#FFFFFF',
  },
  newBanner: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    borderRadius: 8,
    alignItems: 'center',
  },
  newBannerText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: spacing.lg,
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
