import React from 'react';
import { View, Text, ScrollView, RefreshControl, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useChannels } from '@/src/hooks/useChannels';
import { ChannelList } from '@/src/components/ChannelList';
import { LoadingScreen } from '@/src/components/LoadingScreen';
import { EmptyState } from '@/src/components/EmptyState';
import { Channel } from '@/src/types';
import { colors, spacing, typography } from '@/src/constants/theme';

export default function CommunityScreen() {
  const router = useRouter();
  const { groupedChannels, isLoading, isError, refetch } = useChannels();
  const [refreshing, setRefreshing] = React.useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const handleChannelPress = (channel: Channel) => {
    if (channel.isLocked) return;
    router.push(`/(tabs)/community/${channel.slug}`);
  };

  if (isLoading && !refreshing) {
    return <LoadingScreen />;
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Community</Text>
        <Text style={styles.subtitle}>Connect with traders</Text>
      </View>

      {isError ? (
        <EmptyState
          icon="⚠️"
          title="Failed to load channels"
          message="Pull down to retry"
        />
      ) : Object.keys(groupedChannels).length === 0 ? (
        <EmptyState
          icon="💬"
          title="No channels yet"
          message="Channels will appear here once available"
        />
      ) : (
        <ScrollView
          style={styles.scroll}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
        >
          <ChannelList
            groupedChannels={groupedChannels}
            onChannelPress={handleChannelPress}
          />
          <View style={styles.bottomPadding} />
        </ScrollView>
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
  scroll: {
    flex: 1,
  },
  bottomPadding: {
    height: 40,
  },
});
