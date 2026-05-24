import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Channel } from '@/src/types';
import { colors, spacing, typography, borderRadius } from '@/src/constants/theme';

interface ChannelListProps {
  groupedChannels: Record<string, Channel[]>;
  onChannelPress: (channel: Channel) => void;
}

export function ChannelList({ groupedChannels, onChannelPress }: ChannelListProps) {
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  const toggleGroup = (category: string) => {
    setCollapsedGroups((prev) => ({
      ...prev,
      [category]: !prev[category],
    }));
  };

  const categories = Object.keys(groupedChannels);

  return (
    <View style={styles.container}>
      {categories.map((category) => {
        const channels = groupedChannels[category];
        const isCollapsed = collapsedGroups[category];

        return (
          <View key={category} style={styles.group}>
            <TouchableOpacity
              style={styles.groupHeader}
              onPress={() => toggleGroup(category)}
              activeOpacity={0.7}
            >
              <Text style={styles.groupChevron}>{isCollapsed ? '▸' : '▾'}</Text>
              <Text style={styles.groupTitle}>{category.toUpperCase()}</Text>
              <Text style={styles.groupCount}>{channels.length}</Text>
            </TouchableOpacity>

            {!isCollapsed &&
              channels.map((channel) => (
                <TouchableOpacity
                  key={channel.id}
                  style={styles.channelRow}
                  onPress={() => onChannelPress(channel)}
                  activeOpacity={0.6}
                >
                  <Text style={styles.channelEmoji}>{channel.emoji || '#'}</Text>
                  <Text
                    style={[
                      styles.channelName,
                      channel.unreadCount > 0 && styles.channelNameUnread,
                    ]}
                    numberOfLines={1}
                  >
                    {channel.name}
                  </Text>

                  <View style={styles.channelRight}>
                    {channel.isLocked && <Text style={styles.lockIcon}>🔒</Text>}
                    {channel.unreadCount > 0 && (
                      <View style={styles.unreadBadge}>
                        <Text style={styles.unreadText}>
                          {channel.unreadCount > 99 ? '99+' : channel.unreadCount}
                        </Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              ))}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  group: {
    marginBottom: spacing.sm,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  groupChevron: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
    marginRight: spacing.sm,
    width: 12,
  },
  groupTitle: {
    fontSize: typography.sizes.xs,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 1,
    flex: 1,
  },
  groupCount: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
  },
  channelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    marginHorizontal: spacing.sm,
    borderRadius: borderRadius.sm,
  },
  channelEmoji: {
    fontSize: 18,
    marginRight: spacing.md,
    width: 28,
    textAlign: 'center',
  },
  channelName: {
    fontSize: typography.sizes.md,
    color: colors.textSecondary,
    flex: 1,
  },
  channelNameUnread: {
    color: colors.textPrimary,
    fontWeight: '600',
  },
  channelRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  lockIcon: {
    fontSize: 12,
  },
  unreadBadge: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xs,
  },
  unreadText: {
    fontSize: typography.sizes.xs,
    fontWeight: '700',
    color: colors.background,
  },
});
