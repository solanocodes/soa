'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { connectSocket } from '@/lib/socket';
import { useAuthStore } from '@/lib/store';
import { getRelativeTime, getInitials, hasAccess } from '@/lib/utils';
import styles from './page.module.css';

interface Alert {
  id: string;
  channel_slug: string;
  author_id: string;
  content: string;
  ticker: string | null;
  direction: string | null;
  has_image: boolean;
  image_url: string | null;
  created_at: string;
  author: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
}

interface TabConfig {
  label: string;
  slug: string | null;
  requiredTier?: string;
}

const TABS: TabConfig[] = [
  { label: 'All', slug: null },
  { label: 'Solano', slug: 'solano-alerts' },
  { label: 'Demon', slug: 'demon-alerts' },
  { label: 'Bryce', slug: 'bryce-alerts' },
  { label: 'Wealth', slug: 'wealth-alerts', requiredTier: 'SOA_WEALTH' },
];

const AVATAR_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
  '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F',
];

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export default function AlertsPage() {
  const user = useAuthStore((s) => s.user);
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [newAlertsCount, setNewAlertsCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const visibleTabs = TABS.filter(
    (t) => !t.requiredTier || hasAccess(user?.tier || 'FREE', t.requiredTier)
  );

  const fetchAlerts = useCallback(
    async (channelSlug: string | null, cursorVal?: string | null) => {
      try {
        let url = '/alerts?limit=20';
        if (channelSlug) url += `&channel_slug=${channelSlug}`;
        if (cursorVal) url += `&cursor=${cursorVal}`;
        const { data } = await api.get(url);
        const items: Alert[] = data.alerts ?? data;
        return {
          items,
          nextCursor: data.nextCursor ?? (items.length >= 20 ? items[items.length - 1]?.id : null),
          hasMore: !!data.nextCursor || items.length >= 20,
        };
      } catch (err) {
        throw err;
      }
    },
    []
  );

  // Initial load and tab change
  useEffect(() => {
    if (!user) return;
    setLoading(true);
    setError(null);
    setAlerts([]);
    setCursor(null);
    setHasMore(true);
    setNewAlertsCount(0);

    fetchAlerts(activeTab)
      .then(({ items, nextCursor, hasMore: more }) => {
        setAlerts(items);
        setCursor(nextCursor);
        setHasMore(more);
      })
      .catch(() => setError('Failed to load alerts'))
      .finally(() => setLoading(false));
  }, [activeTab, fetchAlerts, user]);

  // Load more
  const loadMore = async () => {
    if (loadingMore || !hasMore || !cursor) return;
    setLoadingMore(true);
    try {
      const { items, nextCursor, hasMore: more } = await fetchAlerts(activeTab, cursor);
      setAlerts((prev) => [...prev, ...items]);
      setCursor(nextCursor);
      setHasMore(more);
    } catch {
      // silent
    } finally {
      setLoadingMore(false);
    }
  };

  // Socket for new alerts
  useEffect(() => {
    const socket = connectSocket();

    const handleNewAlert = (alert: Alert) => {
      if (activeTab && alert.channel_slug !== activeTab) return;
      setNewAlertsCount((c) => c + 1);
    };

    socket.on('new_alert', handleNewAlert);

    return () => {
      socket.off('new_alert', handleNewAlert);
    };
  }, [activeTab]);

  const showNewAlerts = () => {
    setNewAlertsCount(0);
    setLoading(true);
    fetchAlerts(activeTab)
      .then(({ items, nextCursor, hasMore: more }) => {
        setAlerts(items);
        setCursor(nextCursor);
        setHasMore(more);
      })
      .finally(() => setLoading(false));
  };

  return (
    <div className={styles.container}>
      <div className={styles.tabs}>
        {visibleTabs.map((tab) => (
          <button
            key={tab.label}
            className={`${styles.tab} ${
              activeTab === tab.slug ? styles.tabActive : styles.tabInactive
            }`}
            onClick={() => setActiveTab(tab.slug)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {newAlertsCount > 0 && (
        <div className={styles.newAlertsBanner}>
          <button className={styles.newAlertsBtn} onClick={showNewAlerts}>
            {newAlertsCount} new alert{newAlertsCount > 1 ? 's' : ''} - Click to refresh
          </button>
        </div>
      )}

      {loading ? (
        <div className={styles.centerState}>
          <div className={styles.spinner} />
          <span>Loading alerts...</span>
        </div>
      ) : error ? (
        <div className={styles.centerState}>
          <span style={{ color: 'var(--danger)' }}>{error}</span>
          <button className={styles.loadMoreBtn} onClick={() => setActiveTab(activeTab)}>
            Retry
          </button>
        </div>
      ) : alerts.length === 0 ? (
        <div className={styles.centerState}>
          <span>No alerts yet</span>
        </div>
      ) : (
        <>
          <div className={styles.alertList}>
            {alerts.map((alert) => {
              const name = alert.author?.display_name || alert.author?.username || 'Unknown';
              return (
                <div key={alert.id} className={styles.alertCard}>
                  <div className={styles.alertHeader}>
                    <div
                      className={styles.alertAvatar}
                      style={{ background: getAvatarColor(name) }}
                    >
                      {getInitials(name)}
                    </div>
                    <span className={styles.alertAuthor}>{name}</span>
                    <span className={styles.alertTime}>
                      {getRelativeTime(alert.created_at)}
                    </span>
                  </div>

                  {(alert.ticker || alert.direction) && (
                    <div className={styles.alertBadges}>
                      {alert.ticker && (
                        <span className={styles.tickerBadge}>{alert.ticker}</span>
                      )}
                      {alert.direction && (
                        <span
                          className={`${styles.directionBadge} ${
                            alert.direction.toLowerCase() === 'long'
                              ? styles.directionLong
                              : styles.directionShort
                          }`}
                        >
                          {alert.direction}
                        </span>
                      )}
                    </div>
                  )}

                  <div className={styles.alertContent}>{alert.content}</div>

                  {alert.has_image && alert.image_url && (
                    <img
                      src={alert.image_url}
                      alt="Alert chart"
                      className={styles.alertImage}
                      loading="lazy"
                    />
                  )}
                </div>
              );
            })}
          </div>

          {hasMore && (
            <div className={styles.loadMoreWrapper}>
              <button
                className={styles.loadMoreBtn}
                onClick={loadMore}
                disabled={loadingMore}
              >
                {loadingMore ? 'Loading...' : 'Load more'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
