import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { format } from 'date-fns';
import { JournalEntry } from '@/src/types';
import { colors, spacing, typography, borderRadius } from '@/src/constants/theme';

interface JournalEntryCardProps {
  entry: JournalEntry;
  onPress?: () => void;
}

export function JournalEntryCard({ entry, onPress }: JournalEntryCardProps) {
  const { ticker, direction, pnl, pnlPercentage, entryPrice, exitPrice, setupType, coachReviewed, createdAt } = entry;
  const isProfit = pnl >= 0;
  const dateStr = format(new Date(createdAt), 'MMM d, yyyy');

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.7}
      disabled={!onPress}
    >
      <View style={styles.topRow}>
        <View style={styles.tickerRow}>
          <Text style={styles.ticker}>${ticker}</Text>
          <View
            style={[
              styles.directionBadge,
              direction === 'LONG' ? styles.longBadge : styles.shortBadge,
            ]}
          >
            <Text
              style={[
                styles.directionText,
                direction === 'LONG' ? styles.longText : styles.shortText,
              ]}
            >
              {direction}
            </Text>
          </View>
          {coachReviewed && (
            <View style={styles.reviewedBadge}>
              <Text style={styles.reviewedIcon}>✓</Text>
              <Text style={styles.reviewedText}>Reviewed</Text>
            </View>
          )}
        </View>

        <View style={styles.pnlContainer}>
          <Text style={[styles.pnl, isProfit ? styles.profit : styles.loss]}>
            {isProfit ? '+' : ''}${Math.abs(pnl).toFixed(2)}
          </Text>
          <Text style={[styles.pnlPercent, isProfit ? styles.profit : styles.loss]}>
            {isProfit ? '+' : ''}{pnlPercentage.toFixed(1)}%
          </Text>
        </View>
      </View>

      <View style={styles.detailsRow}>
        <View style={styles.detail}>
          <Text style={styles.detailLabel}>Entry</Text>
          <Text style={styles.detailValue}>${entryPrice.toFixed(2)}</Text>
        </View>
        <View style={styles.detail}>
          <Text style={styles.detailLabel}>Exit</Text>
          <Text style={styles.detailValue}>${exitPrice.toFixed(2)}</Text>
        </View>
        <View style={styles.detail}>
          <Text style={styles.detailLabel}>Setup</Text>
          <Text style={styles.detailValue}>{setupType}</Text>
        </View>
        <View style={styles.detail}>
          <Text style={styles.detailLabel}>Date</Text>
          <Text style={styles.detailValue}>{dateStr}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  tickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  ticker: {
    fontSize: typography.sizes.lg,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  directionBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  longBadge: {
    backgroundColor: colors.primaryDim,
  },
  shortBadge: {
    backgroundColor: 'rgba(255, 68, 68, 0.13)',
  },
  directionText: {
    fontSize: typography.sizes.xs,
    fontWeight: '700',
  },
  longText: {
    color: colors.primary,
  },
  shortText: {
    color: colors.danger,
  },
  reviewedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  reviewedIcon: {
    fontSize: typography.sizes.xs,
    color: colors.primary,
  },
  reviewedText: {
    fontSize: typography.sizes.xs,
    color: colors.primary,
    fontWeight: '600',
  },
  pnlContainer: {
    alignItems: 'flex-end',
  },
  pnl: {
    fontSize: typography.sizes.lg,
    fontWeight: '700',
  },
  pnlPercent: {
    fontSize: typography.sizes.xs,
    marginTop: 1,
  },
  profit: {
    color: colors.primary,
  },
  loss: {
    color: colors.danger,
  },
  detailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceElevated,
    padding: spacing.md,
    borderRadius: borderRadius.sm,
  },
  detail: {
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  detailValue: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    fontWeight: '500',
  },
});
