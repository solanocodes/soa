import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Tier } from '@/src/types';
import { colors, spacing, typography, borderRadius } from '@/src/constants/theme';

interface TierBadgeProps {
  tier: Tier;
  size?: 'sm' | 'md';
}

const tierConfig: Record<Tier, { label: string; color: string; bg: string }> = {
  FREE: { label: 'FREE', color: colors.textSecondary, bg: 'rgba(136, 136, 136, 0.15)' },
  CORE: { label: 'CORE', color: colors.primary, bg: colors.primaryDim },
  WEALTH: { label: 'WEALTH', color: colors.gold, bg: 'rgba(201, 168, 76, 0.15)' },
  BOT: { label: 'BOT', color: '#4A9EFF', bg: 'rgba(74, 158, 255, 0.15)' },
};

export function TierBadge({ tier, size = 'sm' }: TierBadgeProps) {
  const config = tierConfig[tier];

  return (
    <View style={[styles.badge, { backgroundColor: config.bg }, size === 'md' && styles.badgeMd]}>
      <Text style={[styles.text, { color: config.color }, size === 'md' && styles.textMd]}>
        {config.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  badgeMd: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  text: {
    fontSize: typography.sizes.xs,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  textMd: {
    fontSize: typography.sizes.sm,
  },
});
