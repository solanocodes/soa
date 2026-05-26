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
  email: string;
  display_name: string | null;
  username: string;
  tier: string;
  is_admin: boolean;
  is_coach: boolean;
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
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [editTier, setEditTier] = useState('');
  const [editAdmin, setEditAdmin] = useState(false);
  const [editCoach, setEditCoach] = useState(false);
  const [saving, setSaving] = useState(false);

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
              <th>Role</th>
              <th>Last Active</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const tierColor = TIER_COLORS[u.tier] || TIER_COLORS.FREE;
              const tierLabel = TIER_LABELS[u.tier] || u.tier;
              const isEditing = editingUser === u.id;
              const role = u.is_admin ? 'Admin' : u.is_coach ? 'Coach' : 'Member';
              return (
                <tr key={u.id}>
                  <td className={styles.userName}>
                    {u.display_name || u.username}
                  </td>
                  <td>@{u.username}</td>
                  <td>
                    {isEditing ? (
                      <select
                        value={editTier}
                        onChange={(e) => setEditTier(e.target.value)}
                        style={{ background: 'var(--surface-elevated)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '4px', padding: '4px 8px', fontSize: '13px' }}
                      >
                        <option value="FREE">Free</option>
                        <option value="SOA_CORE">SOA Core</option>
                        <option value="SOA_WEALTH">SOA Wealth</option>
                        <option value="BOT_PRODUCT">Bot Product</option>
                      </select>
                    ) : (
                      <span
                        className={styles.userTierBadge}
                        style={{ color: tierColor, background: `${tierColor}1a` }}
                      >
                        {tierLabel}
                      </span>
                    )}
                  </td>
                  <td>
                    {isEditing ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                          <input type="checkbox" checked={editAdmin} onChange={(e) => setEditAdmin(e.target.checked)} /> Admin
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                          <input type="checkbox" checked={editCoach} onChange={(e) => setEditCoach(e.target.checked)} /> Coach
                        </label>
                      </div>
                    ) : (
                      <span style={{ color: role === 'Admin' ? 'var(--gold)' : role === 'Coach' ? 'var(--primary)' : 'var(--text-secondary)', fontSize: '13px' }}>
                        {role}
                      </span>
                    )}
                  </td>
                  <td>
                    {u.last_active_at ? getRelativeTime(u.last_active_at) : 'Never'}
                  </td>
                  <td>
                    {isEditing ? (
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          onClick={async () => {
                            setSaving(true);
                            try {
                              await api.patch(`/admin/users/${u.id}/tier`, {
                                tier: editTier,
                                is_admin: editAdmin,
                                is_coach: editCoach,
                              });
                              setUsers(prev => prev.map(x => x.id === u.id ? { ...x, tier: editTier, is_admin: editAdmin, is_coach: editCoach } : x));
                              setEditingUser(null);
                            } catch { /* silent */ }
                            finally { setSaving(false); }
                          }}
                          disabled={saving}
                          style={{ background: 'var(--primary)', color: '#000', border: 'none', borderRadius: '4px', padding: '4px 10px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
                        >
                          {saving ? '...' : 'Save'}
                        </button>
                        <button
                          onClick={() => setEditingUser(null)}
                          style={{ background: 'var(--surface-elevated)', color: 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: '4px', padding: '4px 10px', fontSize: '12px', cursor: 'pointer' }}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setEditingUser(u.id);
                          setEditTier(u.tier);
                          setEditAdmin(u.is_admin);
                          setEditCoach(u.is_coach);
                        }}
                        style={{ background: 'none', color: 'var(--primary)', border: '1px solid var(--primary)', borderRadius: '4px', padding: '4px 10px', fontSize: '12px', cursor: 'pointer' }}
                      >
                        Edit
                      </button>
                    )}
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
