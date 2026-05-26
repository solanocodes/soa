'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
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
  alert_type: string;
  has_image: boolean;
  image_url: string | null;
  is_historical: boolean;
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
  const searchParams = useSearchParams();
  const tabFromUrl = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState<string | null>(tabFromUrl);

  useEffect(() => {
    if (tabFromUrl) setActiveTab(tabFromUrl);
  }, [tabFromUrl]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const visibleTabs = TABS.filter(
    (t) => !t.requiredTier || hasAccess(user?.tier || 'FREE', t.requiredTier)
  );

  const fetchAlerts = useCallback(
    async (channelSlug: string | null, cursorId?: string | null) => {
      const params: Record<string, string> = { limit: '50' };
      if (channelSlug) params.channel_slug = channelSlug;
      if (cursorId) params.cursor = cursorId;
      const { data } = await api.get('/alerts', { params });
      const items: Alert[] = data.alerts ?? [];
      return {
        items,
        nextCursor: items.length >= 50 ? items[items.length - 1]?.id : null,
      };
    },
    []
  );

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setAlerts([]);
    setCursor(null);
    setHasMore(true);

    fetchAlerts(activeTab)
      .then(({ items, nextCursor }) => {
        if (cancelled) return;
        setAlerts(items);
        setCursor(nextCursor);
        setHasMore(!!nextCursor);
      })
      .catch(() => { if (!cancelled) setError('Failed to load alerts'); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [activeTab, fetchAlerts, user]);

  const loadMore = async () => {
    if (loadingMore || !hasMore || !cursor) return;
    setLoadingMore(true);
    try {
      const { items, nextCursor } = await fetchAlerts(activeTab, cursor);
      setAlerts((prev) => [...prev, ...items]);
      setCursor(nextCursor);
      setHasMore(!!nextCursor);
    } catch {
      // silent
    } finally {
      setLoadingMore(false);
    }
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

      {loading ? (
        <div className={styles.centerState}>
          <div className={styles.spinner} />
          <span>Loading alerts...</span>
        </div>
      ) : error ? (
        <div className={styles.centerState}>
          <span style={{ color: 'var(--danger)' }}>{error}</span>
          <button className={styles.loadMoreBtn} onClick={() => { setError(null); setLoading(true); fetchAlerts(activeTab).then(({ items, nextCursor }) => { setAlerts(items); setCursor(nextCursor); setHasMore(!!nextCursor); }).catch(() => setError('Failed to load alerts')).finally(() => setLoading(false)); }}>
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
              const name = alert.author?.display_name || alert.author?.username || 'Sean Solano';
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

                  {alert.has_image && alert.image_url && alert.image_url.startsWith('http') && (
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
