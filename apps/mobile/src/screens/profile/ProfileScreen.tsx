import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { useAuthStore } from '../../stores/authStore';
import { Button } from '../../components/ui/Button';
import { colors, tierColors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

const TIER_LABELS: Record<string, string> = {
  free: 'FREE',
  core: 'SOA CORE',
  wealth: 'SOA WEALTH',
  bot: 'BOT PRODUCT',
};

const TIER_COLOR_MAP: Record<string, string> = {
  free: tierColors.tierFree,
  core: tierColors.tierCore,
  wealth: tierColors.tierWealth,
  bot: tierColors.tierBot,
};

export function ProfileScreen() {
  const { user, logout } = useAuthStore();

  const tierLabel = TIER_LABELS[user?.tier ?? 'free'] ?? 'FREE';
  const tierColor = TIER_COLOR_MAP[user?.tier ?? 'free'] ?? tierColors.tierFree;
  const initial = user?.displayName?.charAt(0)?.toUpperCase() ?? 'U';

  const handleLogout = () => {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: async () => {
          await logout();
        },
      },
    ]);
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Profile</Text>
      </View>

      {/* User Info Section */}
      <View style={styles.userSection}>
        <View style={styles.avatarContainer}>
          <Text style={styles.avatarText}>{initial}</Text>
        </View>
        <Text style={styles.displayName}>
          {user?.displayName ?? 'User'}
        </Text>
        <Text style={styles.username}>@{user?.username ?? 'username'}</Text>
        <Text style={styles.email}>{user?.email ?? ''}</Text>

        {/* Tier Badge */}
        <View style={[styles.tierBadge, { backgroundColor: tierColor + '20' }]}>
          <Text style={[styles.tierBadgeText, { color: tierColor }]}>
            {tierLabel}
          </Text>
        </View>

        {/* Tier Expiry - placeholder field name since User interface doesn't have it yet */}
        {(user as any)?.tier_expires_at && (
          <Text style={styles.tierExpiry}>
            Expires:{' '}
            {new Date((user as any).tier_expires_at).toLocaleDateString()}
          </Text>
        )}
      </View>

      {/* Stats Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Stats</Text>
        <View style={styles.statsCard}>
          <Text style={styles.comingSoonText}>Coming Soon</Text>
          <Text style={styles.comingSoonSubtext}>
            Your trading stats will appear here
          </Text>
        </View>
      </View>

      {/* Settings Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Settings</Text>

        <TouchableOpacity style={styles.settingsRow} activeOpacity={0.7}>
          <Text style={styles.settingsRowText}>Notification Preferences</Text>
          <Text style={styles.settingsRowArrow}>&gt;</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.settingsRow} activeOpacity={0.7}>
          <Text style={styles.settingsRowText}>1-on-1 Chat with Coach</Text>
          <Text style={styles.settingsRowArrow}>&gt;</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.settingsRow} activeOpacity={0.7}>
          <Text style={styles.settingsRowText}>Account Settings</Text>
          <Text style={styles.settingsRowArrow}>&gt;</Text>
        </TouchableOpacity>
      </View>

      {/* Logout Button */}
      <View style={styles.logoutSection}>
        <Button
          title="Log Out"
          onPress={handleLogout}
          variant="outline"
          size="lg"
          style={styles.logoutButton}
        />
      </View>

      {/* Footer Info */}
      <View style={styles.footer}>
        {(user as any)?.created_at && (
          <Text style={styles.footerText}>
            Member since{' '}
            {new Date((user as any).created_at).toLocaleDateString()}
          </Text>
        )}
        <Text style={styles.versionText}>SOA Mobile v1.0.0</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  contentContainer: {
    paddingBottom: 40,
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: spacing.xxl,
    paddingBottom: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
  },
  userSection: {
    alignItems: 'center',
    paddingTop: spacing.xxxl,
    paddingHorizontal: spacing.xxl,
    paddingBottom: spacing.xxl,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  avatarContainer: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.primaryDim,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  avatarText: {
    fontSize: 36,
    fontWeight: '700',
    color: colors.primary,
  },
  displayName: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  username: {
    fontSize: 15,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  email: {
    fontSize: 14,
    color: colors.textMuted,
    marginBottom: spacing.lg,
  },
  tierBadge: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 20,
  },
  tierBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  tierExpiry: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  section: {
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.xxl,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: spacing.md,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statsCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.xxl,
    alignItems: 'center',
  },
  comingSoonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  comingSoonSubtext: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  settingsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    marginBottom: spacing.sm,
  },
  settingsRowText: {
    fontSize: 15,
    color: colors.text,
    fontWeight: '500',
  },
  settingsRowArrow: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  logoutSection: {
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.xxxl,
  },
  logoutButton: {
    borderColor: colors.danger,
  },
  footer: {
    alignItems: 'center',
    paddingTop: spacing.xxxl,
    paddingBottom: spacing.xxl,
  },
  footerText: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  versionText: {
    fontSize: 12,
    color: colors.textMuted,
  },
});
