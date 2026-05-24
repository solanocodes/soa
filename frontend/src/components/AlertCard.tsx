import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { format } from 'date-fns';
import { Alert } from '@/src/types';
import { colors, spacing, typography, borderRadius } from '@/src/constants/theme';

interface AlertCardProps {
  alert: Alert;
}

export function AlertCard({ alert }: AlertCardProps) {
  const { author, content, ticker, direction, entryPrice, targetPrice, stopLoss, attachments, createdAt } = alert;
  const timeStr = format(new Date(createdAt), 'MMM d, h:mm a');
  const hasImage = attachments.length > 0 && attachments[0].type === 'image';

  return (
    <View style={styles.card}>
      <View style={styles.accentBorder} />
      <View style={styles.inner}>
        <View style={styles.header}>
          <View style={styles.authorRow}>
            {author.avatar ? (
              <Image source={{ uri: author.avatar }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <Text style={styles.avatarLetter}>
                  {author.displayName.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            <View>
              <Text style={styles.authorName}>{author.displayName}</Text>
              <Text style={styles.timestamp}>{timeStr}</Text>
            </View>
          </View>
          {ticker && (
            <View style={styles.tickerBadge}>
              <Text style={styles.tickerText}>${ticker}</Text>
              {direction && (
                <Text
                  style={[
                    styles.directionText,
                    direction === 'LONG' ? styles.longText : styles.shortText,
                  ]}
                >
                  {direction}
                </Text>
              )}
            </View>
          )}
        </View>

        <Text style={styles.content}>{content}</Text>

        {(entryPrice || targetPrice || stopLoss) && (
          <View style={styles.priceRow}>
            {entryPrice != null && (
              <View style={styles.priceItem}>
                <Text style={styles.priceLabel}>Entry</Text>
                <Text style={styles.priceValue}>${entryPrice.toFixed(2)}</Text>
              </View>
            )}
            {targetPrice != null && (
              <View style={styles.priceItem}>
                <Text style={styles.priceLabel}>Target</Text>
                <Text style={[styles.priceValue, { color: colors.primary }]}>
                  ${targetPrice.toFixed(2)}
                </Text>
              </View>
            )}
            {stopLoss != null && (
              <View style={styles.priceItem}>
                <Text style={styles.priceLabel}>Stop</Text>
                <Text style={[styles.priceValue, { color: colors.danger }]}>
                  ${stopLoss.toFixed(2)}
                </Text>
              </View>
            )}
          </View>
        )}

        {hasImage && (
          <Image
            source={{ uri: attachments[0].thumbnailUrl || attachments[0].url }}
            style={styles.image}
            resizeMode="cover"
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  accentBorder: {
    width: 3,
    backgroundColor: colors.primary,
  },
  inner: {
    flex: 1,
    padding: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  avatarPlaceholder: {
    backgroundColor: colors.surfaceElevated,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  avatarLetter: {
    fontSize: typography.sizes.sm,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  authorName: {
    fontSize: typography.sizes.sm,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  timestamp: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
    marginTop: 1,
  },
  tickerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    gap: spacing.xs,
  },
  tickerText: {
    fontSize: typography.sizes.sm,
    fontWeight: '700',
    color: colors.textPrimary,
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
  content: {
    fontSize: typography.sizes.md,
    color: colors.textPrimary,
    lineHeight: 22,
    marginBottom: spacing.sm,
  },
  priceRow: {
    flexDirection: 'row',
    gap: spacing.lg,
    backgroundColor: colors.surfaceElevated,
    padding: spacing.md,
    borderRadius: borderRadius.sm,
    marginBottom: spacing.sm,
  },
  priceItem: {
    alignItems: 'center',
  },
  priceLabel: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  priceValue: {
    fontSize: typography.sizes.sm,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  image: {
    width: '100%',
    height: 180,
    borderRadius: borderRadius.sm,
    marginTop: spacing.sm,
    backgroundColor: colors.surfaceElevated,
  },
});
