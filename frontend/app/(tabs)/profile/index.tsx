import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  Share,
  StyleSheet,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '@/src/hooks/useAuth';
import { TierBadge } from '@/src/components/TierBadge';
import { StatsCard } from '@/src/components/StatsCard';
import { LoadingScreen } from '@/src/components/LoadingScreen';
import { colors, spacing, typography, borderRadius } from '@/src/constants/theme';

export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout, isLoading } = useAuth();

  if (isLoading || !user) {
    return <LoadingScreen />;
  }

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  const handleShareReferral = async () => {
    try {
      await Share.share({
        message: `Join me on SOA (Simply Options Academy)! Use my referral code: ${user.referralCode}\n\nhttps://simplyoptionsacademy.com/join?ref=${user.referralCode}`,
      });
    } catch (err) {
      // Silently handle share errors
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Profile Header */}
        <View style={styles.profileSection}>
          <View style={styles.avatarContainer}>
            {user.avatar ? (
              <Image source={{ uri: user.avatar }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <Text style={styles.avatarLetter}>
                  {user.displayName.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            <View style={styles.tierBadgeContainer}>
              <TierBadge tier={user.tier} size="md" />
            </View>
          </View>

          <Text style={styles.displayName}>{user.displayName}</Text>
          <Text style={styles.username}>@{user.username}</Text>
        </View>

        {/* Stats */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your Stats</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statsRow}>
              <StatsCard
                icon="🎯"
                label="Win Rate"
                value={`${user.stats.winRate.toFixed(0)}%`}
                color={colors.primary}
              />
              <StatsCard
                icon="💰"
                label="Total P&L"
                value={`$${Math.abs(user.stats.totalPnL).toFixed(0)}`}
                color={user.stats.totalPnL >= 0 ? colors.primary : colors.danger}
              />
            </View>
            <View style={styles.statsRow}>
              <StatsCard
                icon="🔥"
                label="Streak"
                value={`${user.stats.currentStreak}`}
                color={colors.warning}
              />
              <StatsCard
                icon="📊"
                label="Trades"
                value={`${user.stats.totalTrades}`}
              />
            </View>
            <View style={styles.statsRow}>
              <StatsCard
                icon="📓"
                label="Journal"
                value={`${user.stats.journalEntries}`}
              />
              <StatsCard
                icon="🎓"
                label="Courses"
                value={`${user.stats.coursesCompleted}`}
              />
            </View>
          </View>
        </View>

        {/* Prop Firm Accounts */}
        {user.propFirmAccounts.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Prop Firm Accounts</Text>
            {user.propFirmAccounts.map((account) => (
              <View key={account.id} style={styles.propCard}>
                <View style={styles.propHeader}>
                  <Text style={styles.propFirm}>{account.firmName}</Text>
                  <View
                    style={[
                      styles.propStatusBadge,
                      account.status === 'active' && styles.propStatusActive,
                      account.status === 'passed' && styles.propStatusPassed,
                      account.status === 'failed' && styles.propStatusFailed,
                    ]}
                  >
                    <Text
                      style={[
                        styles.propStatusText,
                        account.status === 'active' && { color: colors.primary },
                        account.status === 'passed' && { color: colors.gold },
                        account.status === 'failed' && { color: colors.danger },
                      ]}
                    >
                      {account.status.toUpperCase()}
                    </Text>
                  </View>
                </View>
                <View style={styles.propDetails}>
                  <View style={styles.propDetail}>
                    <Text style={styles.propLabel}>Account Size</Text>
                    <Text style={styles.propValue}>
                      ${account.accountSize.toLocaleString()}
                    </Text>
                  </View>
                  <View style={styles.propDetail}>
                    <Text style={styles.propLabel}>Balance</Text>
                    <Text style={styles.propValue}>
                      ${account.currentBalance.toLocaleString()}
                    </Text>
                  </View>
                  <View style={styles.propDetail}>
                    <Text style={styles.propLabel}>Phase</Text>
                    <Text style={styles.propValue}>
                      {account.phase.charAt(0).toUpperCase() + account.phase.slice(1)}
                    </Text>
                  </View>
                </View>
                {/* Progress to target */}
                <View style={styles.propProgress}>
                  <View style={styles.propProgressBar}>
                    <View
                      style={[
                        styles.propProgressFill,
                        {
                          width: `${Math.min(
                            ((account.currentBalance - account.accountSize) /
                              account.profitTarget) *
                              100,
                            100
                          )}%`,
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.propProgressText}>
                    ${(account.currentBalance - account.accountSize).toLocaleString()} / $
                    {account.profitTarget.toLocaleString()} target
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Referral */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Referral Program</Text>
          <View style={styles.referralCard}>
            <Text style={styles.referralCode}>{user.referralCode}</Text>
            <Text style={styles.referralHint}>
              Share your code and earn rewards when friends join
            </Text>
            <TouchableOpacity
              style={styles.shareButton}
              onPress={handleShareReferral}
              activeOpacity={0.8}
            >
              <Text style={styles.shareButtonText}>Share Referral Link</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Actions */}
        <View style={styles.section}>
          <TouchableOpacity style={styles.menuItem} activeOpacity={0.7}>
            <Text style={styles.menuIcon}>⚙️</Text>
            <Text style={styles.menuText}>Settings</Text>
            <Text style={styles.menuArrow}>{'>'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuItem} activeOpacity={0.7}>
            <Text style={styles.menuIcon}>🔔</Text>
            <Text style={styles.menuText}>Notifications</Text>
            <Text style={styles.menuArrow}>{'>'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuItem} activeOpacity={0.7}>
            <Text style={styles.menuIcon}>❓</Text>
            <Text style={styles.menuText}>Help & Support</Text>
            <Text style={styles.menuArrow}>{'>'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.menuItem, styles.menuItemDanger]}
            onPress={handleLogout}
            activeOpacity={0.7}
          >
            <Text style={styles.menuIcon}>🚪</Text>
            <Text style={[styles.menuText, styles.menuTextDanger]}>Sign Out</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.version}>SOA v1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  profileSection: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: spacing.lg,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  avatarPlaceholder: {
    backgroundColor: colors.surfaceElevated,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.border,
  },
  avatarLetter: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  tierBadgeContainer: {
    position: 'absolute',
    bottom: -4,
    alignSelf: 'center',
  },
  displayName: {
    fontSize: typography.sizes.xl,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  username: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
  },
  section: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sectionTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.lg,
  },
  statsGrid: {
    gap: spacing.sm,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  propCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  propHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  propFirm: {
    fontSize: typography.sizes.lg,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  propStatusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  propStatusActive: {
    backgroundColor: colors.primaryDim,
  },
  propStatusPassed: {
    backgroundColor: 'rgba(201, 168, 76, 0.15)',
  },
  propStatusFailed: {
    backgroundColor: 'rgba(255, 68, 68, 0.13)',
  },
  propStatusText: {
    fontSize: typography.sizes.xs,
    fontWeight: '700',
  },
  propDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  propDetail: {
    alignItems: 'center',
  },
  propLabel: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
    marginBottom: 2,
  },
  propValue: {
    fontSize: typography.sizes.sm,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  propProgress: {
    gap: spacing.xs,
  },
  propProgressBar: {
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    overflow: 'hidden',
  },
  propProgressFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 2,
  },
  propProgressText: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
  },
  referralCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  referralCode: {
    fontSize: typography.sizes.xxl,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: 3,
    marginBottom: spacing.sm,
  },
  referralHint: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  shareButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.sm,
  },
  shareButtonText: {
    fontSize: typography.sizes.sm,
    fontWeight: '700',
    color: colors.background,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  menuItemDanger: {
    marginTop: spacing.md,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  menuIcon: {
    fontSize: 20,
    width: 28,
    textAlign: 'center',
  },
  menuText: {
    fontSize: typography.sizes.md,
    color: colors.textPrimary,
    flex: 1,
  },
  menuTextDanger: {
    color: colors.danger,
  },
  menuArrow: {
    fontSize: typography.sizes.md,
    color: colors.textMuted,
  },
  version: {
    textAlign: 'center',
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
    marginTop: spacing.xl,
  },
});
