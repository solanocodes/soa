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

  const { data: unreadData } = useQuery<Record<string, number>>({
    queryKey: ['channels-unread'],
    queryFn: async () => {
      const { data } = await api.get('/channels/unread');
      return data.unread ?? {};
    },
    refetchInterval: 30000,
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
    'direct-messages': '/dms',
  };

  const EXTERNAL_CHANNELS: Record<string, string> = {};

  const EMBED_CHANNELS: Record<string, { title: string; description: string; url: string }> = {
    'trade-sessions': {
      title: 'Full Live Trade Recordings',
      description: 'You have full access to ALL trading sessions we have here at Simply Options Academy.\n\nThis is where you will get the best breakdown of how I think when I am trading.',
      url: 'https://soa.app.clientclub.net/courses/library-v2',
    },
    'futures-lab': {
      title: 'SOA Futures Lab',
      description: 'The SOA Futures Lab is a project dedicated to getting you from 0 knowledge about futures to getting funded and receiving payouts!\n\nThis workshop shows you everything you need to know to get funded fully from start to finish. Risk, strategy, rules, everything you need to succeed as a futures trader.\n\n0 -> Funded -> Payout',
      url: 'https://soa.app.clientclub.net/courses/library-v2',
    },
    'masterclasses': {
      title: 'Masterclasses',
      description: 'Anytime I give you guys a masterclass (15+ minutes long) I will categorize every single one and have them neatly placed for you.\n\nSo that anytime you need any help with either the SOA strategy, journaling, psychology etc you will know exactly where to go!',
      url: 'https://soa.app.clientclub.net/courses/library-v2',
    },
    'mastery-course': {
      title: 'Simply Options Academy Foundation Course',
      description: 'Once you guys get here make sure you check your email for the instructions on getting access to the foundations course. After you have fully completed the Simply Options Course, message me in our 1 on 1 chat and we will discuss the next steps!\n\nMeanwhile, make sure you guys are showing up to the masterclasses, Q&As and Live Trading Sessions!',
      url: 'https://soa.app.clientclub.net/courses/library-v2',
    },
    'trade-journal': {
      title: 'SOA Trading Journal',
      description: 'Track and analyze your trades in the SOA Trading Journal.\n\nLog every trade, review your performance, and identify patterns in your trading to continuously improve.',
      url: 'https://app.simplyoptionsacademy.com',
    },
  };

  const HIDDEN_CHANNELS = ['demon-alerts', 'bryce-alerts', 'best-wins'];

  const handleChannelClick = (channel: Channel) => {
    const channelTierLevel = getTierLevel(channel.required_tier);
    if (channelTierLevel > userTierLevel) return;

    if (EXTERNAL_CHANNELS[channel.slug]) {
      window.open(EXTERNAL_CHANNELS[channel.slug], '_blank');
      return;
    }
    if (EMBED_CHANNELS[channel.slug]) {
      router.push(`/community/${channel.slug}`);
      return;
    }
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
  const isDmsPage = pathname.startsWith('/dms');

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
                      || (isWinsPage && ch.slug === 'share-your-wins')
                      || (isDmsPage && ch.slug === 'direct-messages');

                    const hasUnread = !locked && !active && unreadData && unreadData[ch.id] > 0;

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
                        {hasUnread && (
                          <span className={styles.unreadDot} />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

        </div>


        <div className={styles.userBar}>
          {user?.avatar_url ? (
            <img src={user.avatar_url} alt="" className={styles.avatar} style={{ objectFit: 'cover' }} />
          ) : (
            <div className={styles.avatar}>
              {getInitials(displayName || 'U')}
            </div>
          )}
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
