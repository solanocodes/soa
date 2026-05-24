import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

export interface MessageAuthor {
  username: string;
  display_name?: string;
  avatar_url?: string;
  is_admin?: boolean;
  is_coach?: boolean;
}

export interface Message {
  id: string;
  content: string;
  created_at: string;
  author: MessageAuthor;
  image_url?: string;
}

interface MessageBubbleProps {
  message: Message;
}

function getRelativeTime(dateString: string): string {
  const now = new Date();
  const date = new Date(dateString);
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSeconds < 60) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function getInitial(author: MessageAuthor): string {
  const name = author.display_name || author.username;
  return name.charAt(0).toUpperCase();
}

function getAvatarColor(username: string): string {
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = username.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 60%, 45%)`;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const { author } = message;
  const isStaff = author.is_admin || author.is_coach;
  const displayName = author.display_name || author.username;

  return (
    <View style={[styles.container, isStaff && styles.staffContainer]}>
      {/* Avatar */}
      <View style={styles.avatarContainer}>
        {author.avatar_url ? (
          <Image source={{ uri: author.avatar_url }} style={styles.avatar} />
        ) : (
          <View
            style={[
              styles.avatar,
              styles.avatarPlaceholder,
              { backgroundColor: getAvatarColor(author.username) },
            ]}
          >
            <Text style={styles.avatarText}>{getInitial(author)}</Text>
          </View>
        )}
      </View>

      {/* Message content */}
      <View style={styles.contentContainer}>
        <View style={styles.header}>
          <Text style={[styles.authorName, isStaff && styles.staffName]}>
            {displayName}
          </Text>
          {author.is_admin && (
            <View style={[styles.badge, styles.adminBadge]}>
              <Text style={styles.badgeText}>Admin</Text>
            </View>
          )}
          {author.is_coach && !author.is_admin && (
            <View style={[styles.badge, styles.coachBadge]}>
              <Text style={styles.badgeText}>Coach</Text>
            </View>
          )}
          <Text style={styles.timestamp}>
            {getRelativeTime(message.created_at)}
          </Text>
        </View>

        <Text style={styles.messageText}>{message.content}</Text>

        {message.image_url && (
          <Image
            source={{ uri: message.image_url }}
            style={styles.imageAttachment}
            resizeMode="cover"
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  staffContainer: {
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  avatarContainer: {
    marginRight: spacing.md,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  avatarPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  contentContainer: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  authorName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginRight: spacing.sm,
  },
  staffName: {
    color: colors.primary,
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: spacing.sm,
  },
  adminBadge: {
    backgroundColor: colors.gold + '30',
  },
  coachBadge: {
    backgroundColor: colors.primary + '30',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.text,
  },
  timestamp: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  messageText: {
    fontSize: 15,
    color: colors.text,
    lineHeight: 20,
  },
  imageAttachment: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    marginTop: spacing.sm,
  },
});
