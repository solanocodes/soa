'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { getRelativeTime, getInitials } from '@/lib/utils';
import styles from './page.module.css';

interface Thread {
  id: string;
  ai_mode?: string;
  other_user: {
    id: string;
    username: string;
    display_name: string | null;
  };
  last_message: {
    content: string;
    created_at: string;
  } | null;
  unread_count: number;
  pending_suggestions_count?: number;
}

interface UserResult {
  id: string;
  username: string;
  display_name: string | null;
}

const AVATAR_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
  '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F',
  '#BB8FCE', '#85C1E9', '#00D084', '#C9A84C',
];

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export default function DmsPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // New DM state
  const [showNewDm, setShowNewDm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [creating, setCreating] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const isCoachOrAdmin = user?.is_coach || user?.is_admin;

  useEffect(() => {
    setLoading(true);
    api
      .get('/dms/threads')
      .then(({ data }) => {
        setThreads(data.threads ?? data ?? []);
      })
      .catch(() => setError('Failed to load conversations'))
      .finally(() => setLoading(false));
  }, []);

  // Fetch pending suggestion counts for coach/admin
  useEffect(() => {
    if (!isCoachOrAdmin || threads.length === 0) return;

    const fetchSuggestionCounts = async () => {
      const updated = await Promise.all(
        threads.map(async (thread) => {
          try {
            const { data } = await api.get(
              `/dms/threads/${thread.id}/ai-suggestions`
            );
            return {
              ...thread,
              pending_suggestions_count: data.suggestions?.length || 0,
            };
          } catch {
            return thread;
          }
        })
      );
      setThreads(updated);
    };

    fetchSuggestionCounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCoachOrAdmin, threads.length]);

  // Search users for new DM
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const timeout = setTimeout(async () => {
      setSearching(true);
      try {
        const { data } = await api.get(`/users/search?q=${encodeURIComponent(searchQuery.trim())}`);
        setSearchResults(data.users ?? []);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => clearTimeout(timeout);
  }, [searchQuery]);

  // Focus search input when panel opens
  useEffect(() => {
    if (showNewDm) {
      searchInputRef.current?.focus();
    }
  }, [showNewDm]);

  const handleStartDm = async (otherUser: UserResult) => {
    setCreating(true);
    try {
      // For admin/coach starting a DM, pass the user as student
      // For student, pass the other user as coach
      const payload = isCoachOrAdmin
        ? { student_id: otherUser.id }
        : { coach_id: otherUser.id };

      const { data } = await api.post('/dms/threads', payload);
      const thread = data.thread;
      router.push(`/dms/${thread.id}`);
    } catch {
      setError('Failed to create conversation');
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.centerState}>
          <div className={styles.spinner} />
          <span>Loading conversations...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.centerState}>
          <span style={{ color: 'var(--danger)' }}>{error}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.titleRow}>
        <h1 className={styles.title}>Direct Messages</h1>
        {isCoachOrAdmin && (
          <button
            className={styles.newDmBtn}
            onClick={() => setShowNewDm(!showNewDm)}
          >
            {showNewDm ? 'Cancel' : 'New Message'}
          </button>
        )}
      </div>

      {/* New DM search panel */}
      {showNewDm && (
        <div className={styles.newDmPanel}>
          <input
            ref={searchInputRef}
            className={styles.searchInput}
            type="text"
            placeholder="Search users by name or username..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searching && (
            <div className={styles.searchLoading}>Searching...</div>
          )}
          {searchResults.length > 0 && (
            <div className={styles.searchResults}>
              {searchResults.map((u) => (
                <button
                  key={u.id}
                  className={styles.searchResultRow}
                  onClick={() => handleStartDm(u)}
                  disabled={creating}
                >
                  <div
                    className={styles.searchResultAvatar}
                    style={{
                      background: getAvatarColor(
                        u.display_name || u.username
                      ),
                    }}
                  >
                    {getInitials(u.display_name || u.username)}
                  </div>
                  <div className={styles.searchResultInfo}>
                    <span className={styles.searchResultName}>
                      {u.display_name || u.username}
                    </span>
                    <span className={styles.searchResultUsername}>
                      @{u.username}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
          {searchQuery.trim() && !searching && searchResults.length === 0 && (
            <div className={styles.searchEmpty}>No users found</div>
          )}
        </div>
      )}

      {threads.length === 0 ? (
        <div className={styles.centerState}>
          <div className={styles.emptyIcon}>&#9993;</div>
          <span>No conversations yet</span>
        </div>
      ) : (
        <div className={styles.threadList}>
          {threads.map((thread) => {
            const name =
              thread.other_user?.display_name ||
              thread.other_user?.username ||
              'Unknown';
            const hasPendingSuggestions =
              isCoachOrAdmin && (thread.pending_suggestions_count || 0) > 0;

            return (
              <Link
                key={thread.id}
                href={`/dms/${thread.id}`}
                className={styles.threadRow}
              >
                <div
                  className={styles.threadAvatar}
                  style={{ background: getAvatarColor(name) }}
                >
                  {getInitials(name)}
                </div>
                <div className={styles.threadInfo}>
                  <div className={styles.threadName}>
                    {name}
                    {hasPendingSuggestions && (
                      <span className={styles.aiSuggestionBadge}>
                        AI
                      </span>
                    )}
                  </div>
                  <div className={styles.threadPreview}>
                    {thread.last_message?.content || 'No messages yet'}
                  </div>
                </div>
                <div className={styles.threadMeta}>
                  {thread.last_message && (
                    <span className={styles.threadTime}>
                      {getRelativeTime(thread.last_message.created_at)}
                    </span>
                  )}
                  {thread.unread_count > 0 && (
                    <span className={styles.unreadBadge}>
                      {thread.unread_count > 9 ? '9+' : thread.unread_count}
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
