'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store';
import styles from './AppShell.module.css';

const TIER_COLORS: Record<string, string> = {
  FREE: 'var(--tier-free)',
  SOA_CORE: 'var(--tier-core)',
  SOA_WEALTH: 'var(--tier-wealth)',
  BOT_PRODUCT: 'var(--tier-bot)',
};

const TIER_LABELS: Record<string, string> = {
  FREE: 'Free',
  SOA_CORE: 'Core',
  SOA_WEALTH: 'Wealth',
  BOT_PRODUCT: 'Bot',
};

function getInitials(name: string | null | undefined): string {
  if (!name) return '?';
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

interface NavItem {
  label: string;
  href: string;
  icon: string;
  adminOnly?: boolean;
}

const NAV_ITEMS: { section: string; items: NavItem[] }[] = [
  {
    section: 'Community',
    items: [
      { label: 'Channels', href: '/community', icon: '#' },
      { label: 'Alerts', href: '/alerts', icon: '⚡' },
      { label: 'Wins', href: '/wins', icon: '🏆' },
      { label: 'DMs', href: '/dms', icon: '✉' },
    ],
  },
  {
    section: 'Learn',
    items: [
      { label: 'Courses', href: '/learn', icon: '🎓' },
      { label: 'Strategy Vault', href: '/strategy', icon: '📈' },
      { label: 'Journal', href: '/journal', icon: '📓' },
    ],
  },
  {
    section: 'Account',
    items: [
      { label: 'Profile', href: '/profile', icon: '👤' },
      { label: 'Admin', href: '/admin', icon: '⚙', adminOnly: true },
    ],
  },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isAuthenticated, isLoading } = useAuthStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [isLoading, isAuthenticated, router]);

  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  if (isLoading) {
    return (
      <div className={styles.shell}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>Loading...</div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return null;
  }

  const tierColor = TIER_COLORS[user.tier] || TIER_COLORS.FREE;
  const tierLabel = TIER_LABELS[user.tier] || user.tier;

  return (
    <div className={styles.shell}>
      {sidebarOpen && (
        <div className={styles.overlay} onClick={() => setSidebarOpen(false)} />
      )}

      <aside className={`${styles.sidebar} ${sidebarOpen ? styles.sidebarOpen : ''}`}>
        <div className={styles.logo}>
          <div className={styles.logoIcon}>S</div>
          SOA
        </div>

        <nav className={styles.nav}>
          {NAV_ITEMS.map((group) => (
            <React.Fragment key={group.section}>
              <div className={styles.navSection}>{group.section}</div>
              {group.items
                .filter((item) => !item.adminOnly || user.is_admin)
                .map((item) => {
                  const isActive =
                    pathname === item.href || pathname.startsWith(item.href + '/');
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`${styles.navLink} ${isActive ? styles.navLinkActive : ''}`}
                    >
                      <span className={styles.navIcon}>{item.icon}</span>
                      {item.label}
                    </Link>
                  );
                })}
            </React.Fragment>
          ))}
        </nav>

        <Link href="/profile" className={styles.sidebarUser}>
          <div
            className={styles.sidebarAvatar}
            style={{ background: tierColor, color: '#000' }}
          >
            {getInitials(user.display_name || user.username)}
          </div>
          <div className={styles.sidebarUserInfo}>
            <div className={styles.sidebarUserName}>
              {user.display_name || user.username}
            </div>
            <div className={styles.sidebarUserTier} style={{ color: tierColor }}>
              {tierLabel}
            </div>
          </div>
        </Link>
      </aside>

      <div className={styles.contentWrapper}>
        <header className={styles.topbar}>
          <button
            className={styles.menuButton}
            onClick={() => setSidebarOpen(true)}
            aria-label="Open menu"
          >
            &#9776;
          </button>
          <div className={styles.topbarTitle}>
            {NAV_ITEMS.flatMap((g) => g.items).find(
              (i) => pathname === i.href || pathname.startsWith(i.href + '/')
            )?.label || 'SOA'}
          </div>
        </header>

        <div className={styles.content}>{children}</div>
      </div>
    </div>
  );
}
