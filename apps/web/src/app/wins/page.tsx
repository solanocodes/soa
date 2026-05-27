'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { getRelativeTime, getInitials } from '@/lib/utils';
import styles from './page.module.css';

interface Win {
  id: string;
  user_id: string | null;
  caption: string | null;
  screenshot_url: string | null;
  win_type: string;
  pnl_amount: number | null;
  is_verified: boolean;
  is_historical: boolean;
  original_author_name: string | null;
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
  const user = useAuthStore((s) => s.user);
  const [wins, setWins] = useState<Win[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [winText, setWinText] = useState('');
  const [winImage, setWinImage] = useState<string | null>(null);

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
    if (!user) return;
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
  }, [fetchWins, user]);

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

  const handlePostWin = async () => {
    if (!winText.trim() && !winImage) return;
    setUploading(true);
    try {
      const { data } = await api.post('/wins', {
        caption: winText.trim() || null,
        screenshot_url: winImage || null,
      });
      if (data.win) {
        setWins((prev) => [{ ...data.win, author: { id: user?.id || '', username: user?.username || '', display_name: user?.display_name || null, avatar_url: user?.avatar_url || null } }, ...prev]);
      }
      setWinText('');
      setWinImage(null);
    } catch {
      // silent
    } finally {
      setUploading(false);
    }
  };

  const handleWinPaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => setWinImage(reader.result as string);
        reader.readAsDataURL(file);
        return;
      }
    }
  };

  const handleWinFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setWinImage(reader.result as string);
    reader.readAsDataURL(file);
  };

  const filteredWins = wins.filter(w =>
    w.caption || (w.screenshot_url && w.screenshot_url.startsWith('http'))
  );

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Student Wins</h1>
      </div>

      <div className={styles.composeArea}>
        <div className={styles.composeRow}>
          <input
            className={styles.composeInput}
            placeholder="Share your win! What did you accomplish today?"
            value={winText}
            onChange={(e) => setWinText(e.target.value)}
            onPaste={handleWinPaste}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handlePostWin(); } }}
          />
          <div className={styles.composeActions}>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleWinFileSelect}
            />
            <button className={styles.composeImgBtn} onClick={() => fileInputRef.current?.click()} title="Add image">
              📷
            </button>
            <button
              className={styles.composeSendBtn}
              onClick={handlePostWin}
              disabled={(!winText.trim() && !winImage) || uploading}
            >
              {uploading ? '...' : 'Post'}
            </button>
          </div>
        </div>
        {winImage && (
          <div className={styles.composePreview}>
            <img src={winImage} alt="Preview" />
            <button className={styles.composePreviewRemove} onClick={() => setWinImage(null)}>×</button>
          </div>
        )}
      </div>

      {filteredWins.length === 0 ? (
        <div className={styles.centerState}>
          <span>No wins posted yet. Be the first!</span>
        </div>
      ) : (
        <>
          <div className={styles.grid}>
            {filteredWins.map((win) => {
              const isHistorical = win.is_historical && !win.author?.username;
              const name = win.author?.display_name || win.author?.username || '';

              if (isHistorical) {
                return (
                  <div key={win.id} className={`${styles.card} ${styles.cardVerified}`}>
                    {win.screenshot_url && win.screenshot_url.startsWith('http') && (
                      <img
                        src={win.screenshot_url}
                        alt="Win"
                        className={styles.screenshot}
                        loading="lazy"
                      />
                    )}
                  </div>
                );
              }

              return (
                <div
                  key={win.id}
                  className={`${styles.card} ${win.is_verified ? styles.cardVerified : ''}`}
                >
                  <div className={styles.cardHeader}>
                    <div
                      className={styles.cardAvatar}
                      style={{ background: getAvatarColor(name || 'S') }}
                    >
                      {getInitials(name || 'S')}
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

                  {win.caption && (
                    <p className={styles.caption}>{win.caption}</p>
                  )}

                  {win.screenshot_url && win.screenshot_url.startsWith('http') && (
                    <img
                      src={win.screenshot_url}
                      alt="Win screenshot"
                      className={styles.screenshot}
                      loading="lazy"
                    />
                  )}

                  {win.pnl_amount != null && (
                    <div className={styles.pnl}>{formatPnl(win.pnl_amount)}</div>
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
