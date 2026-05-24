import React, { useState } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { format } from 'date-fns';
import { Message } from '@/src/types';
import { TierBadge } from './TierBadge';
import { colors, spacing, typography, borderRadius } from '@/src/constants/theme';

interface MessageBubbleProps {
  message: Message;
  onReact?: (messageId: string, emoji: string) => void;
  currentUserId?: string;
}

export function MessageBubble({ message, onReact, currentUserId }: MessageBubbleProps) {
  const [expandedImage, setExpandedImage] = useState<string | null>(null);
  const { author, content, attachments, reactions, createdAt } = message;

  const timeStr = format(new Date(createdAt), 'h:mm a');

  return (
    <View style={styles.container}>
      <View style={styles.avatarWrapper}>
        {author.avatar ? (
          <Image source={{ uri: author.avatar }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder]}>
            <Text style={styles.avatarLetter}>
              {author.displayName.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.body}>
        <View style={styles.header}>
          <Text style={[styles.displayName, author.isAdmin && styles.adminName]}>
            {author.displayName}
          </Text>
          <TierBadge tier={author.tier} />
          <Text style={styles.timestamp}>{timeStr}</Text>
        </View>

        <Text style={styles.content}>{content}</Text>

        {attachments.length > 0 && (
          <View style={styles.attachments}>
            {attachments.map((attachment) => {
              if (attachment.type === 'image') {
                return (
                  <TouchableOpacity
                    key={attachment.id}
                    onPress={() =>
                      setExpandedImage(
                        expandedImage === attachment.url ? null : attachment.url
                      )
                    }
                    activeOpacity={0.9}
                  >
                    <Image
                      source={{ uri: attachment.thumbnailUrl || attachment.url }}
                      style={[
                        styles.attachmentImage,
                        expandedImage === attachment.url && styles.attachmentImageExpanded,
                      ]}
                      resizeMode="cover"
                    />
                  </TouchableOpacity>
                );
              }
              return (
                <View key={attachment.id} style={styles.fileAttachment}>
                  <Text style={styles.fileIcon}>📎</Text>
                  <Text style={styles.fileName} numberOfLines={1}>
                    {attachment.filename}
                  </Text>
                </View>
              );
            })}
          </View>
        )}

        {reactions.length > 0 && (
          <View style={styles.reactions}>
            {reactions.map((reaction) => {
              const isUserReacted = currentUserId
                ? reaction.userIds.includes(currentUserId)
                : false;
              return (
                <TouchableOpacity
                  key={reaction.emoji}
                  style={[styles.reactionChip, isUserReacted && styles.reactionChipActive]}
                  onPress={() => onReact?.(message.id, reaction.emoji)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.reactionEmoji}>{reaction.emoji}</Text>
                  <Text
                    style={[
                      styles.reactionCount,
                      isUserReacted && styles.reactionCountActive,
                    ]}
                  >
                    {reaction.count}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
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
  avatarWrapper: {
    marginRight: spacing.md,
    marginTop: 2,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
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
  body: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  displayName: {
    fontSize: typography.sizes.sm,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  adminName: {
    color: colors.primary,
  },
  timestamp: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
  },
  content: {
    fontSize: typography.sizes.md,
    color: colors.textPrimary,
    lineHeight: 22,
  },
  attachments: {
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  attachmentImage: {
    width: '100%',
    height: 180,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.surfaceElevated,
  },
  attachmentImageExpanded: {
    height: 320,
  },
  fileAttachment: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    padding: spacing.md,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  fileIcon: {
    fontSize: 16,
    marginRight: spacing.sm,
  },
  fileName: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    flex: 1,
  },
  reactions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  reactionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
  },
  reactionChipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryDim,
  },
  reactionEmoji: {
    fontSize: 14,
    marginRight: 4,
  },
  reactionCount: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
  },
  reactionCountActive: {
    color: colors.primary,
  },
});
