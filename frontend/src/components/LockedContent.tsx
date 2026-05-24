import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Tier } from '@/src/types';
import { colors, spacing, typography, borderRadius } from '@/src/constants/theme';

interface LockedContentProps {
  requiredTier: Tier;
  onUpgrade?: () => void;
}

export function LockedContent({ requiredTier, onUpgrade }: LockedContentProps) {
  return (
    <View style={styles.overlay}>
      <View style={styles.content}>
        <Text style={styles.lockIcon}>🔒</Text>
        <Text style={styles.title}>Content Locked</Text>
        <Text style={styles.message}>
          Upgrade to {requiredTier} to access this content
        </Text>
        {onUpgrade && (
          <TouchableOpacity style={styles.button} onPress={onUpgrade} activeOpacity={0.8}>
            <Text style={styles.buttonText}>Upgrade Now</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10, 10, 10, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: borderRadius.md,
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: spacing.xxl,
  },
  lockIcon: {
    fontSize: 40,
    marginBottom: spacing.md,
  },
  title: {
    fontSize: typography.sizes.lg,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  message: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  button: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.sm,
  },
  buttonText: {
    fontSize: typography.sizes.md,
    fontWeight: '700',
    color: colors.background,
  },
});
