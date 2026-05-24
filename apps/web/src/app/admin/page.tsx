'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { getRelativeTime, TIER_COLORS, TIER_LABELS } from '@/lib/utils';
import styles from './page.module.css';

interface DashboardStats {
  total_students: number;
  new_this_week: number;
  inactive_7_days: number;
  students_by_tier: Record<string, number>;
}

interface AdminUser {
  id: string;
  display_name: string | null;
  username: string;
  tier: string;
  last_active_at: string | null;
  created_at: string;
}

export default function AdminPage() {
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.is_admin ?? false;
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [userCursor, setUserCursor] = useState<string | null>(null);
  const [hasMoreUsers, setHasMoreUsers] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin) return;
    setLoading(true);
    setError(null);

    Promise.all([
      api.get('/admin/dashboard'),
      api.get('/admin/users?limit=20'),
    ])
      .then(([dashRes, usersRes]) => {
        setStats(dashRes.data);
        const userList: AdminUser[] = usersRes.data.users ?? usersRes.data;
        setUsers(userList);
        setUserCursor(
          usersRes.data.nextCursor ??
            (userList.length >= 20 ? userList[userList.length - 1]?.id : null)
        );
        setHasMoreUsers(!!usersRes.data.nextCursor || userList.length >= 20);
      })
      .catch((err) => setError(err?.response?.data?.error || 'Failed to load admin data'))
      .finally(() => setLoading(false));
  }, [isAdmin]);

  const loadMoreUsers = async () => {
    if (loadingUsers || !hasMoreUsers || !userCursor) return;
    setLoadingUsers(true);
    try {
      const { data } = await api.get(`/admin/users?limit=20&cursor=${userCursor}`);
      const more: AdminUser[] = data.users ?? data;
      setUsers((prev) => [...prev, ...more]);
      setUserCursor(
        data.nextCursor ?? (more.length >= 20 ? more[more.length - 1]?.id : null)
      );
      setHasMoreUsers(!!data.nextCursor || more.length >= 20);
    } catch {
      // silent
    } finally {
      setLoadingUsers(false);
    }
  };

  // Access check (after hooks)
  if (!isAdmin) {
    return (
      <div className={styles.denied}>
        <div className={styles.deniedIcon}>🔒</div>
        <div className={styles.deniedText}>Access Denied</div>
        <div className={styles.deniedSub}>You need admin privileges to view this page.</div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.centerState}>
          <div className={styles.spinner} />
          <span>Loading dashboard...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.centerState}>
          <span style={{ color: 'var(--danger)' }}>{error}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Admin Dashboard</h1>

      {stats && (
        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>Total Students</div>
            <div className={styles.statValue}>{stats.total_students.toLocaleString()}</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>New This Week</div>
            <div className={styles.statValue} style={{ color: 'var(--primary)' }}>
              +{stats.new_this_week}
            </div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>Inactive 7+ Days</div>
            <div className={styles.statValue} style={{ color: 'var(--warning)' }}>
              {stats.inactive_7_days}
            </div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>Tier Breakdown</div>
            <div className={styles.tierBreakdown}>
              {Object.entries(stats.students_by_tier).map(([tier, count]) => (
                <div key={tier} className={styles.tierRow}>
                  <span>
                    <span
                      className={styles.tierDot}
                      style={{ background: TIER_COLORS[tier] || '#888' }}
                    />
                    {TIER_LABELS[tier] || tier}
                  </span>
                  <span className={styles.tierCount}>{count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className={styles.tableWrapper}>
        <div className={styles.tableTitle}>Users</div>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Name</th>
              <th>Username</th>
              <th>Tier</th>
              <th>Last Active</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const tierColor = TIER_COLORS[u.tier] || TIER_COLORS.FREE;
              const tierLabel = TIER_LABELS[u.tier] || u.tier;
              return (
                <tr key={u.id}>
                  <td className={styles.userName}>
                    {u.display_name || u.username}
                  </td>
                  <td>@{u.username}</td>
                  <td>
                    <span
                      className={styles.userTierBadge}
                      style={{
                        color: tierColor,
                        background: `${tierColor}1a`,
                      }}
                    >
                      {tierLabel}
                    </span>
                  </td>
                  <td>
                    {u.last_active_at
                      ? getRelativeTime(u.last_active_at)
                      : 'Never'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {hasMoreUsers && (
          <div className={styles.loadMoreWrapper}>
            <button
              className={styles.loadMoreBtn}
              onClick={loadMoreUsers}
              disabled={loadingUsers}
            >
              {loadingUsers ? 'Loading...' : 'Load more users'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
