'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { getRelativeTime, getInitials } from '@/lib/utils';
import styles from './page.module.css';

interface Win {
  id: string;
  user_id: string;
  content: string | null;
  ticker: string | null;
  profit_amount: number | null;
  profit_percent: number | null;
  image_url: string | null;
  is_verified: boolean;
  created_at: string;
  author: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
}

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

function formatPnl(amount: number): string {
  const prefix = amount >= 0 ? '+' : '';
  return `${prefix}$${Math.abs(amount).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default function WinsPage() {
  const [wins, setWins] = useState<Win[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchWins = useCallback(async (cursorVal?: string | null) => {
    let url = '/wins?limit=20';
    if (cursorVal) url += `&cursor=${cursorVal}`;
    const { data } = await api.get(url);
    const items: Win[] = data.wins ?? data;
    return {
      items,
      total: data.total_count ?? 0,
      nextCursor: data.nextCursor ?? (items.length >= 20 ? items[items.length - 1]?.id : null),
      hasMore: !!data.nextCursor || items.length >= 20,
    };
  }, []);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchWins()
      .then(({ items, total, nextCursor, hasMore: more }) => {
        setWins(items);
        setTotalCount(total);
        setCursor(nextCursor);
        setHasMore(more);
      })
      .catch(() => setError('Failed to load wins'))
      .finally(() => setLoading(false));
  }, [fetchWins]);

  const loadMore = async () => {
    if (loadingMore || !hasMore || !cursor) return;
    setLoadingMore(true);
    try {
      const { items, nextCursor, hasMore: more } = await fetchWins(cursor);
      setWins((prev) => [...prev, ...items]);
      setCursor(nextCursor);
      setHasMore(more);
    } catch {
      // silent
    } finally {
      setLoadingMore(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.centerState}>
          <div className={styles.spinner} />
          <span>Loading wins...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.centerState}>
          <span style={{ color: 'var(--danger)' }}>{error}</span>
          <button className={styles.loadMoreBtn} onClick={() => window.location.reload()}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Student Wins</h1>
        {totalCount > 0 && (
          <span className={styles.countBadge}>{totalCount}</span>
        )}
      </div>

      {wins.length === 0 ? (
        <div className={styles.centerState}>
          <span>No wins posted yet. Be the first!</span>
        </div>
      ) : (
        <>
          <div className={styles.grid}>
            {wins.map((win) => {
              const name =
                win.author?.display_name ||
                win.author?.username ||
                'Anonymous';

              return (
                <div
                  key={win.id}
                  className={`${styles.card} ${win.is_verified ? styles.cardVerified : ''}`}
                >
                  <div className={styles.cardHeader}>
                    <div
                      className={styles.cardAvatar}
                      style={{ background: getAvatarColor(name) }}
                    >
                      {getInitials(name)}
                    </div>
                    <div className={styles.cardAuthorInfo}>
                      <div className={styles.cardAuthor}>{name}</div>
                      <div className={styles.cardTime}>
                        {getRelativeTime(win.created_at)}
                      </div>
                    </div>
                    {win.is_verified && (
                      <div className={styles.verifiedBadge} title="Verified">
                        &#10003;
                      </div>
                    )}
                  </div>

                  {win.content && (
                    <p className={styles.caption}>{win.content}</p>
                  )}

                  {win.image_url && (
                    <img
                      src={win.image_url}
                      alt="Win screenshot"
                      className={styles.screenshot}
                      loading="lazy"
                    />
                  )}

                  {win.profit_amount != null && (
                    <div className={styles.pnl}>{formatPnl(win.profit_amount)}</div>
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
