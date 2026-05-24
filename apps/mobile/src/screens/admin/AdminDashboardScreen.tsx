import React from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, ScrollView } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../services/api';
import { useAuthStore } from '../../stores/authStore';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

interface DashboardStats {
  total_students: number;
  students_by_tier: Record<string, number>;
  inactive_7_days: number;
  new_this_week: number;
}

export function AdminDashboardScreen() {
  const { user } = useAuthStore();

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'dashboard'],
    queryFn: async () => {
      const res = await api.get<{ stats: DashboardStats }>('/admin/dashboard');
      return res.data.stats;
    },
    enabled: user?.is_admin === true,
  });

  if (!user?.is_admin) {
    return (
      <View style={styles.container}>
        <Text style={styles.accessDenied}>Access Denied</Text>
        <Text style={styles.subtitle}>Admin access required</Text>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.header}>Admin Dashboard</Text>

      <View style={styles.grid}>
        <StatCard label="Total Students" value={data?.total_students ?? 0} />
        <StatCard label="New This Week" value={data?.new_this_week ?? 0} color={colors.primary} />
        <StatCard label="Inactive 7+ Days" value={data?.inactive_7_days ?? 0} color={colors.warning} />
        <StatCard label="Free Tier" value={data?.students_by_tier?.FREE ?? 0} />
        <StatCard label="SOA Core" value={data?.students_by_tier?.SOA_CORE ?? 0} color={colors.primary} />
        <StatCard label="SOA Wealth" value={data?.students_by_tier?.SOA_WEALTH ?? 0} color={colors.gold} />
      </View>
    </ScrollView>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={[styles.statValue, color ? { color } : null]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
  },
  header: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.xl,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  statCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.lg,
    width: '47%',
    borderWidth: 1,
    borderColor: colors.border,
  },
  statValue: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  statLabel: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  accessDenied: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.danger,
    textAlign: 'center',
    marginTop: 100,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
});
