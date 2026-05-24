'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { getRelativeTime, getInitials } from '@/lib/utils';
import styles from './page.module.css';

interface Thread {
  id: string;
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
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      <h1 className={styles.title}>Direct Messages</h1>

      {threads.length === 0 ? (
        <div className={styles.centerState}>
          <div className={styles.emptyIcon}>✉</div>
          <span>No conversations yet</span>
        </div>
      ) : (
        <div className={styles.threadList}>
          {threads.map((thread) => {
            const name =
              thread.other_user?.display_name ||
              thread.other_user?.username ||
              'Unknown';

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
                  <div className={styles.threadName}>{name}</div>
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
