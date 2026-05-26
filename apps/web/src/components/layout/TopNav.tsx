'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/lib/store';
import styles from './TopNav.module.css';

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

const PAGE_TITLES: Record<string, string> = {
  '/community': 'Community',
  '/alerts': 'Alerts',
  '/wins': 'Student Wins',
  '/journal': 'Trading Journal',
  '/learn': 'Courses',
  '/profile': 'Profile',
  '/admin': 'Admin Dashboard',
  '/dms': 'Direct Messages',
  '/strategy': 'Strategy Vault',
};

function getPageTitle(pathname: string): string {
  for (const [path, title] of Object.entries(PAGE_TITLES)) {
    if (pathname === path) return title;
  }
  const communitySlug = pathname.split('/community/')[1];
  if (communitySlug) {
    return communitySlug
      .split('-')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }
  if (pathname.startsWith('/dms/')) return 'Direct Message';
  for (const [path, title] of Object.entries(PAGE_TITLES)) {
    if (pathname.startsWith(path)) return title;
  }
  return 'SOA';
}

export default function TopNav() {
  const pathname = usePathname();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const displayName = user?.display_name || user?.username || '';

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  return (
    <nav className={styles.topNav}>
      <div className={styles.left}>
        <span className={styles.channelName}>{getPageTitle(pathname)}</span>
      </div>

      <div className={styles.right}>
        <button className={styles.iconBtn} aria-label="Notifications" title="Notifications">
          &#128276;
        </button>

        <button
          className={styles.iconBtn}
          aria-label="Direct Messages"
          title="Direct Messages"
          onClick={() => router.push('/dms')}
        >
          &#9993;
        </button>

        <div className={styles.dropdownWrapper} ref={dropdownRef}>
          <button
            className={styles.avatarBtn}
            onClick={() => setDropdownOpen((o) => !o)}
            aria-label="User menu"
            style={user?.avatar_url ? { padding: 0, overflow: 'hidden' } : {}}
          >
            {user?.avatar_url ? (
              <img src={user.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
            ) : (
              getInitials(displayName || 'U')
            )}
          </button>

          {dropdownOpen && (
            <div className={styles.dropdown}>
              <button
                className={styles.dropdownItem}
                onClick={() => {
                  setDropdownOpen(false);
                  router.push('/profile');
                }}
              >
                Profile
              </button>

              {user?.is_admin && (
                <button
                  className={styles.dropdownItem}
                  onClick={() => {
                    setDropdownOpen(false);
                    router.push('/admin');
                  }}
                >
                  Admin
                </button>
              )}

              <div className={styles.divider} />

              <button
                className={`${styles.dropdownItem} ${styles.dropdownDanger}`}
                onClick={handleLogout}
              >
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
