import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { api } from '../../services/api';
import { useAuthStore } from '../../stores/authStore';
import type { CommunityStackParamList } from '../../navigation/CommunityStack';

type NavigationProp = NativeStackNavigationProp<CommunityStackParamList, 'ChannelList'>;

interface Channel {
  id: string;
  name: string;
  emoji: string;
  category: string;
  required_tier: 'free' | 'core' | 'wealth' | 'bot';
}

interface ChannelSection {
  title: string;
  data: Channel[];
}

const TIER_HIERARCHY: Record<string, number> = {
  free: 0,
  core: 1,
  wealth: 2,
  bot: 3,
};

const TIER_DISPLAY_NAMES: Record<string, string> = {
  free: 'FREE',
  core: 'SOA Core',
  wealth: 'SOA Wealth',
  bot: 'Bot Product',
};

const CATEGORY_ORDER = ['Onboarding', 'Chatting Corner', 'Coaching Corner', 'Live'];

function groupChannels(channels: Channel[]): ChannelSection[] {
  const grouped: Record<string, Channel[]> = {};

  channels.forEach((channel) => {
    const category = channel.category || 'General';
    if (!grouped[category]) {
      grouped[category] = [];
    }
    grouped[category].push(channel);
  });

  // Sort by predefined order, then alphabetical for unknown categories
  const sections = Object.entries(grouped)
    .sort(([a], [b]) => {
      const aIdx = CATEGORY_ORDER.indexOf(a);
      const bIdx = CATEGORY_ORDER.indexOf(b);
      if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
      if (aIdx !== -1) return -1;
      if (bIdx !== -1) return 1;
      return a.localeCompare(b);
    })
    .map(([title, data]) => ({ title, data }));

  return sections;
}

export function ChannelListScreen() {
  const navigation = useNavigation<NavigationProp>();
  const user = useAuthStore((state) => state.user);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

  const {
    data: channels,
    isLoading,
    isError,
    refetch,
    isRefetching,
  } = useQuery<Channel[]>({
    queryKey: ['channels'],
    queryFn: async () => {
      const { data } = await api.get('/channels');
      return data;
    },
  });

  const toggleSection = useCallback((title: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(title)) {
        next.delete(title);
      } else {
        next.add(title);
      }
      return next;
    });
  }, []);

  const hasAccess = useCallback(
    (requiredTier: string) => {
      if (!user) return false;
      return TIER_HIERARCHY[user.tier] >= TIER_HIERARCHY[requiredTier];
    },
    [user]
  );

  const handleChannelPress = useCallback(
    (channel: Channel) => {
      if (!hasAccess(channel.required_tier)) {
        Alert.alert(
          'Channel Locked',
          `Upgrade to ${TIER_DISPLAY_NAMES[channel.required_tier]} to access this channel.`,
          [{ text: 'OK' }]
        );
        return;
      }

      navigation.navigate('Channel', {
        channelId: channel.id,
        channelName: `${channel.emoji} ${channel.name}`,
      });
    },
    [hasAccess, navigation]
  );

  const sections = channels ? groupChannels(channels) : [];

  const renderSectionHeader = ({ section }: { section: ChannelSection }) => {
    const isCollapsed = collapsedSections.has(section.title);
    return (
      <TouchableOpacity
        style={styles.sectionHeader}
        onPress={() => toggleSection(section.title)}
        activeOpacity={0.7}
      >
        <Text style={styles.sectionTitle}>{section.title}</Text>
        <Ionicons
          name={isCollapsed ? 'chevron-forward' : 'chevron-down'}
          size={18}
          color={colors.textSecondary}
        />
      </TouchableOpacity>
    );
  };

  const renderItem = ({ item, section }: { item: Channel; section: ChannelSection }) => {
    if (collapsedSections.has(section.title)) return null;

    const locked = !hasAccess(item.required_tier);

    return (
      <TouchableOpacity
        style={styles.channelRow}
        onPress={() => handleChannelPress(item)}
        activeOpacity={0.6}
      >
        <View style={styles.channelInfo}>
          <Text style={styles.channelEmoji}>{item.emoji}</Text>
          <Text style={[styles.channelName, locked && styles.channelNameLocked]}>
            {item.name}
          </Text>
        </View>
        {locked && (
          <Ionicons name="lock-closed" size={16} color={colors.textSecondary} />
        )}
      </TouchableOpacity>
    );
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Community</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  if (isError) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Community</Text>
        </View>
        <View style={styles.errorContainer}>
          <Ionicons name="cloud-offline-outline" size={48} color={colors.textSecondary} />
          <Text style={styles.errorText}>Failed to load channels</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => refetch()}>
            <Text style={styles.retryText}>Tap to retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Community</Text>
      </View>

      {sections.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No channels available</Text>
          <Text style={styles.emptySubtext}>
            Check back soon for community channels
          </Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          renderSectionHeader={renderSectionHeader}
          renderItem={renderItem}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
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
  listContent: {
    paddingBottom: spacing.xxxl,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.md,
    marginTop: spacing.lg,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  channelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.md,
  },
  channelInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  channelEmoji: {
    fontSize: 18,
    marginRight: spacing.md,
  },
  channelName: {
    fontSize: 16,
    color: colors.text,
    fontWeight: '500',
  },
  channelNameLocked: {
    color: colors.textSecondary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xxl,
  },
  errorText: {
    fontSize: 16,
    color: colors.text,
    marginTop: spacing.lg,
    fontWeight: '600',
  },
  retryButton: {
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  retryText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '500',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xxl,
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
