'use client';

import { useState, useEffect, useCallback } from 'react';
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
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [newAlert, setNewAlert] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get('tab');
      if (tab) setActiveTab(tab);
    }
  }, []);
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

  const [pastedImage, setPastedImage] = useState<string | null>(null);

  const handleAlertPaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => setPastedImage(reader.result as string);
        reader.readAsDataURL(file);
        return;
      }
    }
  };

  const handleSendAlert = async () => {
    if (!newAlert.trim() && !pastedImage) return;
    if (sending) return;
    setSending(true);
    try {
      const channelSlug = activeTab || 'solano-alerts';
      let content = newAlert.trim();
      if (pastedImage) {
        content = content ? `${content}\n[image]${pastedImage}[/image]` : `[image]${pastedImage}[/image]`;
      }
      const { data } = await api.post('/alerts', {
        content,
        alert_type: 'trade',
        channel_slug: channelSlug,
      });
      setAlerts((prev) => [data.alert, ...prev]);
      setNewAlert('');
      setPastedImage(null);
    } catch {
      // silent
    } finally {
      setSending(false);
    }
  };

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

      {(user?.is_admin || user?.is_coach) && (
        <div className={styles.alertInputArea}>
          {pastedImage && (
            <div style={{ padding: '8px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <img src={pastedImage} alt="Preview" style={{ height: '60px', borderRadius: '6px' }} />
              <button
                onClick={() => setPastedImage(null)}
                style={{ background: 'var(--danger)', color: '#fff', border: 'none', borderRadius: '4px', padding: '4px 8px', fontSize: '12px', cursor: 'pointer' }}
              >
                Remove
              </button>
            </div>
          )}
          <input
            className={styles.alertInput}
            type="text"
            placeholder="Post a new alert... (paste images with Ctrl+V)"
            value={newAlert}
            onChange={(e) => setNewAlert(e.target.value)}
            onPaste={handleAlertPaste}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendAlert();
              }
            }}
            disabled={sending}
          />
          <button
            className={styles.alertSendBtn}
            onClick={handleSendAlert}
            disabled={(!newAlert.trim() && !pastedImage) || sending}
          >
            {sending ? '...' : 'Post'}
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

                  <div className={styles.alertContent}>
                    {alert.content.includes('[image]') ? (
                      <>
                        {alert.content.replace(/\[image\].*?\[\/image\]/g, '').trim() && (
                          <span>{alert.content.replace(/\[image\].*?\[\/image\]/g, '').trim()}</span>
                        )}
                        {alert.content.match(/\[image\](.*?)\[\/image\]/g)?.map((match: string, i: number) => {
                          const src = match.replace('[image]', '').replace('[/image]', '');
                          return <img key={i} src={src} alt="Chart" style={{ maxWidth: '100%', borderRadius: '8px', marginTop: '8px', display: 'block' }} />;
                        })}
                      </>
                    ) : alert.content}
                  </div>

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
