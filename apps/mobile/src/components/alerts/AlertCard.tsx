import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

export interface Alert {
  id: string;
  content: string;
  ticker?: string;
  direction?: string;
  alert_type: string;
  channel_slug: string;
  has_image: boolean;
  image_url?: string;
  created_at: string;
  author: {
    username: string;
    display_name: string;
    avatar_url?: string;
  };
}

interface AlertCardProps {
  alert: Alert;
}

const ALERT_TYPE_COLORS: Record<string, string> = {
  trade: '#00D084',
  trim: '#4488FF',
  target: '#C9A84C',
  stop: '#FF4444',
  commentary: '#666666',
  morning: '#FF8800',
  warning: '#FF4444',
};

const ALERT_TYPE_LABELS: Record<string, string> = {
  trade: 'Trade',
  trim: 'Trim',
  target: 'Target',
  stop: 'Stop',
  commentary: 'Commentary',
  morning: 'Morning',
  warning: 'Warning',
};

function getRelativeTime(dateString: string): string {
  const now = new Date();
  const date = new Date(dateString);
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString();
}

export function AlertCard({ alert }: AlertCardProps) {
  const typeColor = ALERT_TYPE_COLORS[alert.alert_type] ?? '#666666';
  const typeLabel = ALERT_TYPE_LABELS[alert.alert_type] ?? alert.alert_type;
  const initial = alert.author.display_name?.charAt(0)?.toUpperCase() ?? 'A';

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.authorRow}>
          {alert.author.avatar_url ? (
            <Image
              source={{ uri: alert.author.avatar_url }}
              style={styles.avatar}
            />
          ) : (
            <View style={styles.avatarFallback}>
              <Text style={styles.avatarText}>{initial}</Text>
            </View>
          )}
          <View style={styles.authorInfo}>
            <Text style={styles.authorName}>{alert.author.display_name}</Text>
            <Text style={styles.timestamp}>
              {getRelativeTime(alert.created_at)}
            </Text>
          </View>
        </View>
        <View style={[styles.typeBadge, { backgroundColor: typeColor + '25' }]}>
          <Text style={[styles.typeBadgeText, { color: typeColor }]}>
            {typeLabel}
          </Text>
        </View>
      </View>

      <Text style={styles.content}>{alert.content}</Text>

      {alert.ticker && (
        <View style={styles.tickerBadge}>
          <Text style={styles.tickerText}>${alert.ticker}</Text>
        </View>
      )}

      {alert.has_image && alert.image_url && (
        <Image
          source={{ uri: alert.image_url }}
          style={styles.alertImage}
          resizeMode="contain"
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
    padding: spacing.lg,
    marginBottom: spacing.md,
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
    flex: 1,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: spacing.sm,
  },
  avatarFallback: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primaryDim,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  avatarText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  authorInfo: {
    flex: 1,
  },
  authorName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  timestamp: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  typeBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: 10,
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  content: {
    fontSize: 15,
    color: colors.text,
    lineHeight: 22,
    marginBottom: spacing.sm,
  },
  tickerBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primaryDim,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: spacing.sm,
  },
  tickerText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
  },
  alertImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    marginTop: spacing.sm,
  },
});
