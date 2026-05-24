import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { Win } from '@/src/types';
import { colors, spacing, typography, borderRadius } from '@/src/constants/theme';

interface WinCardProps {
  win: Win;
}

export function WinCard({ win }: WinCardProps) {
  const { user, caption, pnl, screenshot, verified } = win;
  const isProfit = pnl >= 0;

  return (
    <View style={styles.card}>
      {screenshot && (
        <Image
          source={{ uri: screenshot.thumbnailUrl || screenshot.url }}
          style={styles.screenshot}
          resizeMode="cover"
        />
      )}
      <View style={styles.body}>
        <View style={styles.userRow}>
          {user.avatar ? (
            <Image source={{ uri: user.avatar }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Text style={styles.avatarLetter}>
                {user.displayName.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <Text style={styles.userName}>{user.displayName}</Text>
          {verified && (
            <View style={styles.verifiedBadge}>
              <Text style={styles.verifiedIcon}>✓</Text>
              <Text style={styles.verifiedText}>Verified</Text>
            </View>
          )}
        </View>

        <Text style={styles.caption}>{caption}</Text>

        <Text style={[styles.pnl, isProfit ? styles.profit : styles.loss]}>
          {isProfit ? '+' : ''}${Math.abs(pnl).toFixed(2)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.gold,
  },
  screenshot: {
    width: '100%',
    height: 180,
    backgroundColor: colors.surfaceElevated,
  },
  body: {
    padding: spacing.lg,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  avatarPlaceholder: {
    backgroundColor: colors.surfaceElevated,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  avatarLetter: {
    fontSize: typography.sizes.xs,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  userName: {
    fontSize: typography.sizes.sm,
    fontWeight: '600',
    color: colors.textPrimary,
    flex: 1,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryDim,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    gap: 2,
  },
  verifiedIcon: {
    fontSize: typography.sizes.xs,
    color: colors.primary,
  },
  verifiedText: {
    fontSize: typography.sizes.xs,
    fontWeight: '600',
    color: colors.primary,
  },
  caption: {
    fontSize: typography.sizes.md,
    color: colors.textPrimary,
    lineHeight: 22,
    marginBottom: spacing.sm,
  },
  pnl: {
    fontSize: typography.sizes.xl,
    fontWeight: '700',
  },
  profit: {
    color: colors.primary,
  },
  loss: {
    color: colors.danger,
  },
});
