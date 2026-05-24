'use client';

import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store';
import { getInitials, TIER_COLORS, TIER_LABELS } from '@/lib/utils';
import styles from './page.module.css';

export default function ProfilePage() {
  const router = useRouter();
  const { user, logout, isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.centerState}>
          <div className={styles.spinner} />
          <span>Loading profile...</span>
        </div>
      </div>
    );
  }

  if (!user) return null;

  const tierColor = TIER_COLORS[user.tier] || TIER_COLORS.FREE;
  const tierLabel = TIER_LABELS[user.tier] || user.tier;
  const displayName = user.display_name || user.username;

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  return (
    <div className={styles.container}>
      <div className={styles.avatarSection}>
        <div
          className={styles.avatar}
          style={{ background: tierColor }}
        >
          {getInitials(displayName)}
        </div>
        <div className={styles.displayName}>{displayName}</div>
        <div className={styles.username}>@{user.username}</div>
        <div className={styles.email}>{user.email}</div>
        <span
          className={styles.tierBadge}
          style={{
            color: tierColor,
            background: `${tierColor}1a`,
          }}
        >
          {tierLabel}
        </span>
      </div>

      <div className={styles.infoCard}>
        {user.tier_expires_at && (
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>Tier Expires</span>
            <span className={styles.infoValue}>
              {new Date(user.tier_expires_at).toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })}
            </span>
          </div>
        )}
        <div className={styles.infoRow}>
          <span className={styles.infoLabel}>Member Since</span>
          <span className={styles.infoValue}>
            {new Date(user.created_at).toLocaleDateString('en-US', {
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })}
          </span>
        </div>
        <div className={styles.infoRow}>
          <span className={styles.infoLabel}>Role</span>
          <span className={styles.infoValue}>
            {user.is_admin ? 'Admin' : user.is_coach ? 'Coach' : 'Member'}
          </span>
        </div>
      </div>

      <h3 className={styles.sectionTitle}>Settings</h3>
      <div className={styles.settingsCard}>
        <div className={styles.settingsRow}>
          <span>Push Notifications</span>
          <span className={styles.comingSoon}>Coming soon</span>
        </div>
        <div className={styles.settingsRow}>
          <span>Email Notifications</span>
          <span className={styles.comingSoon}>Coming soon</span>
        </div>
        <div className={styles.settingsRow}>
          <span>Alert Sound</span>
          <span className={styles.comingSoon}>Coming soon</span>
        </div>
      </div>

      <button className={styles.logoutBtn} onClick={handleLogout}>
        Log Out
      </button>
    </div>
  );
}
