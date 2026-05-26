'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import styles from './Sidebar.module.css';

interface Channel {
  id: string;
  name: string;
  slug: string;
  category: string;
  required_tier: string;
  position: number;
  channel_type: string;
}

interface GroupedChannels {
  [category: string]: Channel[];
}

const TIER_ORDER: Record<string, number> = {
  FREE: 0,
  SOA_CORE: 1,
  SOA_WEALTH: 2,
  BOT_PRODUCT: 3,
};

function getTierLevel(tier: string): number {
  return TIER_ORDER[tier] ?? 0;
}

function getTierBadgeClass(tier: string): string {
  if (tier === 'SOA_WEALTH') return styles.tierWealth;
  if (tier === 'BOT_PRODUCT') return styles.tierBot;
  if (tier === 'SOA_CORE') return styles.tierCore;
  return styles.tierFree;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const { data: channels = [] } = useQuery<Channel[]>({
    queryKey: ['channels'],
    queryFn: async () => {
      const { data } = await api.get('/channels');
      return data.channels ?? data;
    },
  });

  // Close mobile sidebar on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const grouped: GroupedChannels = channels.reduce((acc: GroupedChannels, ch) => {
    if (!acc[ch.category]) acc[ch.category] = [];
    acc[ch.category].push(ch);
    return acc;
  }, {});

  const categoryOrder = [
    'Onboarding',
    'Chatting Corner',
    'Coaching Corner',
    'Live',
  ];

  const sortedCategories = Object.keys(grouped).sort((a, b) => {
    const ai = categoryOrder.indexOf(a);
    const bi = categoryOrder.indexOf(b);
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
  });

  const userTierLevel = getTierLevel(user?.tier || 'FREE');

  const toggleCategory = (cat: string) => {
    setCollapsed((prev) => ({ ...prev, [cat]: !prev[cat] }));
  };

  const ALERT_CHANNELS: Record<string, string> = {
    'solano-alerts': '/alerts?tab=solano-alerts',
    'wealth-alerts': '/alerts?tab=wealth-alerts',
  };

  const SPECIAL_CHANNELS: Record<string, string> = {
    'share-your-wins': '/wins',
  };

  const HIDDEN_CHANNELS = ['demon-alerts', 'bryce-alerts', 'best-wins'];

  const handleChannelClick = (channel: Channel) => {
    const channelTierLevel = getTierLevel(channel.required_tier);
    if (channelTierLevel > userTierLevel) return;

    if (ALERT_CHANNELS[channel.slug]) {
      router.push(ALERT_CHANNELS[channel.slug]);
      return;
    }
    if (SPECIAL_CHANNELS[channel.slug]) {
      router.push(SPECIAL_CHANNELS[channel.slug]);
      return;
    }
    router.push(`/community/${channel.slug}`);
  };

  const currentSlug = pathname.split('/community/')[1] || '';
  const currentTab = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('tab') : null;
  const isWinsPage = pathname === '/wins';

  const displayName = user?.display_name || user?.username || '';
  const TIER_LABELS: Record<string, string> = {
    FREE: 'Free',
    SOA_CORE: 'Core',
    SOA_WEALTH: 'Wealth',
    BOT_PRODUCT: 'Bot',
  };
  const tierLabel = TIER_LABELS[user?.tier || 'FREE'] || 'Free';

  return (
    <>
      <button
        className={styles.hamburger}
        onClick={() => setMobileOpen((o) => !o)}
        aria-label="Toggle sidebar"
      >
        {mobileOpen ? '✕' : '☰'}
      </button>

      <div
        className={`${styles.overlay} ${mobileOpen ? styles.overlayVisible : ''}`}
        onClick={() => setMobileOpen(false)}
      />

      <aside
        className={`${styles.sidebar} ${mobileOpen ? styles.sidebarOpen : ''}`}
      >
        <div className={styles.header}>
          <div>
            <div className={styles.logoText}>SOA</div>
            <div className={styles.logoSub}>Simply Options Academy</div>
          </div>
        </div>

        <div className={styles.channelList}>
          {sortedCategories.map((category) => {
            const isCollapsed = collapsed[category] || false;
            const items = grouped[category].sort(
              (a, b) => a.position - b.position
            );

            return (
              <div key={category} className={styles.category}>
                <div
                  className={styles.categoryHeader}
                  onClick={() => toggleCategory(category)}
                >
                  <span
                    className={`${styles.categoryArrow} ${
                      isCollapsed ? styles.categoryArrowCollapsed : ''
                    }`}
                  >
                    &#9660;
                  </span>
                  <span className={styles.categoryName}>{category}</span>
                </div>

                <div
                  className={`${styles.categoryChannels} ${
                    isCollapsed ? styles.categoryChannelsCollapsed : ''
                  }`}
                >
                  {items.map((ch) => {
                    if (HIDDEN_CHANNELS.includes(ch.slug)) return null;
                    const locked =
                      getTierLevel(ch.required_tier) > userTierLevel;
                    const active = currentSlug === ch.slug
                      || (currentTab === ch.slug)
                      || (isWinsPage && !!SPECIAL_CHANNELS[ch.slug]);

                    return (
                      <div
                        key={ch.id}
                        className={`${styles.channel} ${
                          active ? styles.channelActive : ''
                        } ${locked ? styles.channelLocked : ''}`}
                        onClick={() => handleChannelClick(ch)}
                      >
                        <span className={styles.channelName}>{ch.name}</span>
                        {locked && (
                          <span className={styles.lockIcon}>&#128274;</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

        </div>

        <div style={{ padding: '8px 12px', borderTop: '1px solid #222' }}>
          <Link
            href="/dms"
            className={`${styles.channel} ${pathname.startsWith('/dms') ? styles.channelActive : ''}`}
            style={{ textDecoration: 'none' }}
          >
            <span className={styles.channelName}>✉️ Direct Messages</span>
          </Link>
          <Link
            href="/profile"
            className={`${styles.channel} ${pathname === '/profile' ? styles.channelActive : ''}`}
            style={{ textDecoration: 'none' }}
          >
            <span className={styles.channelName}>👤 Profile</span>
          </Link>
          <Link
            href="/journal"
            className={`${styles.channel} ${pathname === '/journal' ? styles.channelActive : ''}`}
            style={{ textDecoration: 'none' }}
          >
            <span className={styles.channelName}>📓 Journal</span>
          </Link>
          <Link
            href="/learn"
            className={`${styles.channel} ${pathname === '/learn' ? styles.channelActive : ''}`}
            style={{ textDecoration: 'none' }}
          >
            <span className={styles.channelName}>🎓 Courses</span>
          </Link>
          <Link
            href="/strategy"
            className={`${styles.channel} ${pathname === '/strategy' ? styles.channelActive : ''}`}
            style={{ textDecoration: 'none' }}
          >
            <span className={styles.channelName}>📈 Strategy Vault</span>
          </Link>
        </div>

        <div className={styles.userBar}>
          <div className={styles.avatar}>
            {getInitials(displayName || 'U')}
          </div>
          <div className={styles.userInfo}>
            <div className={styles.username}>
              {user?.username || 'Loading...'}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span
                className={`${styles.tierBadge} ${getTierBadgeClass(
                  user?.tier || 'FREE'
                )}`}
              >
                {tierLabel}
              </span>
              {user?.is_admin && (
                <Link
                  href="/admin"
                  style={{
                    fontSize: '11px',
                    color: '#888',
                    textDecoration: 'none',
                  }}
                >
                  Admin
                </Link>
              )}
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
