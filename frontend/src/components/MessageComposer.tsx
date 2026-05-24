import React, { useState } from 'react';
import { View, TextInput, TouchableOpacity, Text, StyleSheet, Platform } from 'react-native';
import { colors, spacing, typography, borderRadius } from '@/src/constants/theme';

interface MessageComposerProps {
  onSend: (content: string, attachments?: string[]) => void;
  onImagePress?: () => void;
  isSending?: boolean;
  typingUsers?: string[];
  placeholder?: string;
}

export function MessageComposer({
  onSend,
  onImagePress,
  isSending,
  typingUsers = [],
  placeholder = 'Type a message...',
}: MessageComposerProps) {
  const [text, setText] = useState('');

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed || isSending) return;
    onSend(trimmed);
    setText('');
  };

  const hasText = text.trim().length > 0;

  return (
    <View style={styles.wrapper}>
      {typingUsers.length > 0 && (
        <View style={styles.typingRow}>
          <Text style={styles.typingText}>
            {typingUsers.length === 1
              ? `${typingUsers[0]} is typing...`
              : `${typingUsers.length} people typing...`}
          </Text>
        </View>
      )}
      <View style={styles.container}>
        {onImagePress && (
          <TouchableOpacity style={styles.iconButton} onPress={onImagePress} activeOpacity={0.7}>
            <Text style={styles.iconText}>📷</Text>
          </TouchableOpacity>
        )}

        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          multiline
          maxLength={2000}
          returnKeyType="default"
        />

        <TouchableOpacity
          style={[styles.sendButton, hasText && !isSending && styles.sendButtonActive]}
          onPress={handleSend}
          disabled={!hasText || isSending}
          activeOpacity={0.7}
        >
          <Text style={[styles.sendIcon, hasText && !isSending && styles.sendIconActive]}>
            ↑
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
    paddingBottom: Platform.OS === 'ios' ? 20 : spacing.sm,
  },
  typingRow: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
  },
  typingText: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    gap: spacing.sm,
  },
  iconButton: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 2,
  },
  iconText: {
    fontSize: 20,
  },
  input: {
    flex: 1,
    backgroundColor: colors.surfaceElevated,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    fontSize: typography.sizes.md,
    color: colors.textPrimary,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceElevated,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 2,
  },
  sendButtonActive: {
    backgroundColor: colors.primary,
  },
  sendIcon: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textMuted,
  },
  sendIconActive: {
    color: colors.background,
  },
});
