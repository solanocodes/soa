'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { connectSocket } from '@/lib/socket';
import { useAuthStore } from '@/lib/store';
import { getRelativeTime, getInitials } from '@/lib/utils';
import styles from './page.module.css';

const EMBED_CHANNELS: Record<string, { title: string; description: string; url: string }> = {
  'trade-sessions': {
    title: 'Full Live Trade Recordings',
    description: 'You have full access to ALL trading sessions we have here at Simply Options Academy.\n\nThis is where you will get the best breakdown of how I think when I am trading.\n\nIf you have issues logging in make sure you\'re using the same email you used to book a call with SOA',
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

interface Channel {
  id: string;
  name: string;
  slug: string;
  category: string;
  required_tier: string;
}

interface Message {
  id: string;
  channel_id: string;
  user_id: string;
  content: string;
  created_at: string;
  author: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
    is_admin: boolean;
    is_coach: boolean;
  };
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

export default function ChannelChatPage() {
  const params = useParams();
  const slug = params.slug as string;
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();

  const [messages, setMessages] = useState<Message[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const feedRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch channel info
  const { data: channel, isLoading: channelLoading, error: channelError } = useQuery<Channel>({
    queryKey: ['channel', slug],
    queryFn: async () => {
      const { data } = await api.get('/channels');
      const list: Channel[] = data.channels ?? data;
      const found = list.find((c: Channel) => c.slug === slug);
      if (!found) throw new Error('Channel not found');
      return found;
    },
    enabled: !!slug,
  });

  // Fetch initial messages
  const { isLoading: msgsLoading, error: msgsError } = useQuery({
    queryKey: ['messages', channel?.id],
    queryFn: async () => {
      const { data } = await api.get(`/channels/${channel!.id}/messages?limit=50`);
      const msgs: Message[] = data.messages ?? data;
      setMessages(msgs.reverse());
      setCursor(data.nextCursor ?? (msgs.length >= 50 ? msgs[0]?.id : null));
      setHasMore(!!data.nextCursor || msgs.length >= 50);
      return msgs;
    },
    enabled: !!channel?.id,
  });

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Socket connection
  useEffect(() => {
    if (!channel?.id) return;
    const socket = connectSocket();

    socket.emit('join_channel', { channel_id: channel.id });

    const handleNewMessage = (msg: Message) => {
      setMessages((prev) => [...prev, msg]);
    };

    const handleTyping = (data: { user_id: string; username: string }) => {
      if (data.user_id === user?.id) return;
      setTypingUsers((prev) =>
        prev.includes(data.username) ? prev : [...prev, data.username]
      );
      setTimeout(() => {
        setTypingUsers((prev) => prev.filter((u) => u !== data.username));
      }, 3000);
    };

    socket.on('new_message', handleNewMessage);
    socket.on('user_typing', handleTyping);

    return () => {
      socket.emit('leave_channel', { channel_id: channel.id });
      socket.off('new_message', handleNewMessage);
      socket.off('user_typing', handleTyping);
    };
  }, [channel?.id, user?.id]);

  // Load more (pagination)
  const loadMore = useCallback(async () => {
    if (!channel?.id || !cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const { data } = await api.get(
        `/channels/${channel.id}/messages?limit=50&cursor=${cursor}`
      );
      const older: Message[] = data.messages ?? data;
      setMessages((prev) => [...older.reverse(), ...prev]);
      setCursor(data.nextCursor ?? (older.length >= 50 ? older[0]?.id : null));
      setHasMore(!!data.nextCursor || older.length >= 50);
    } catch {
      // silent fail
    } finally {
      setLoadingMore(false);
    }
  }, [channel?.id, cursor, loadingMore]);

  // Send message
  const handleSend = async () => {
    if (!newMessage.trim() || !channel?.id || sending) return;
    setSending(true);
    try {
      const { data } = await api.post('/messages', {
        channel_id: channel.id,
        content: newMessage.trim(),
      });
      setMessages((prev) => [...prev, data.message]);
      setNewMessage('');
    } catch {
      // handle error
    } finally {
      setSending(false);
    }
  };

  // Emit typing event
  const handleInputChange = (value: string) => {
    setNewMessage(value);
    if (!channel?.id) return;
    const socket = connectSocket();
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    socket.emit('typing', { channel_id: channel.id });
    typingTimeoutRef.current = setTimeout(() => {}, 2000);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (channelLoading || msgsLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.centerState}>
          <div className={styles.spinner} />
          <span>Loading channel...</span>
        </div>
      </div>
    );
  }

  const embedInfo = EMBED_CHANNELS[slug];
  if (embedInfo) {
    return (
      <div className={styles.container}>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1, padding: '60px 24px' }}>
          <div style={{ maxWidth: '600px', width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              {user?.avatar_url ? (
                <img src={user.avatar_url} alt="" style={{ width: '48px', height: '48px', borderRadius: '50%', objectFit: 'cover' }} />
              ) : (
                <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#00D084', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '18px', color: '#000' }}>SS</div>
              )}
              <span style={{ color: 'var(--primary)', fontWeight: 700, fontSize: '18px' }}>Sean Solano</span>
            </div>
            <div style={{ background: 'var(--surface-elevated)', borderLeft: '4px solid var(--primary)', borderRadius: '0 12px 12px 0', padding: '28px 32px' }}>
              <h2 style={{ color: 'var(--text)', fontSize: '22px', fontWeight: 700, marginBottom: '16px' }}>{embedInfo.title}</h2>
              {embedInfo.description.split('\n\n').map((p, i) => (
                <p key={i} style={{ color: 'var(--text-secondary)', fontSize: '16px', lineHeight: '1.6', marginBottom: '12px' }}>{p}</p>
              ))}
              <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '16px' }}>
                If you have issues logging in make sure you&apos;re using the same email you used to book a call with SOA
              </p>
              <a
                href={embedInfo.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-block',
                  marginTop: '20px',
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  color: 'var(--text)',
                  padding: '10px 24px',
                  borderRadius: '6px',
                  fontSize: '15px',
                  fontWeight: 600,
                  textDecoration: 'none',
                  cursor: 'pointer',
                }}
              >
                LOGIN ↗
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (channelError || msgsError) {
    return (
      <div className={styles.container}>
        <div className={styles.centerState}>
          <span className={styles.errorText}>Failed to load channel</span>
          <button
            className={styles.retryBtn}
            onClick={() => queryClient.invalidateQueries({ queryKey: ['channel', slug] })}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.feed} ref={feedRef}>
        {hasMore && (
          <div className={styles.loadMoreWrapper}>
            <button
              className={styles.loadMoreBtn}
              onClick={loadMore}
              disabled={loadingMore}
            >
              {loadingMore ? 'Loading...' : 'Load older messages'}
            </button>
          </div>
        )}

        {messages.length === 0 && (
          <div className={styles.centerState}>
            <span>No messages yet. Start the conversation!</span>
          </div>
        )}

        {messages.map((msg) => {
          const authorName = msg.author?.display_name || msg.author?.username || 'Unknown';
          const isStaff = msg.author?.is_admin || msg.author?.is_coach;
          const avatarUrl = msg.author?.avatar_url;
          return (
            <div key={msg.id} className={styles.message}>
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt=""
                  className={styles.messageAvatar}
                  style={{ objectFit: 'cover' }}
                />
              ) : (
                <div
                  className={styles.messageAvatar}
                  style={{ background: getAvatarColor(authorName) }}
                >
                  {getInitials(authorName)}
                </div>
              )}
              <div className={styles.messageBody}>
                <div className={styles.messageHeader}>
                  <span
                    className={`${styles.authorName} ${isStaff ? styles.authorStaff : ''}`}
                  >
                    {authorName}
                  </span>
                  <span className={styles.timestamp}>
                    {getRelativeTime(msg.created_at)}
                  </span>
                </div>
                <div className={styles.messageContent}>{msg.content}</div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div className={styles.typingIndicator}>
        {typingUsers.length > 0 &&
          `${typingUsers.join(', ')} ${typingUsers.length === 1 ? 'is' : 'are'} typing...`}
      </div>

      <div className={styles.inputArea}>
        <div className={styles.inputRow}>
          <input
            className={styles.textInput}
            type="text"
            placeholder={`Message #${channel?.name || slug}...`}
            value={newMessage}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={sending}
          />
          <button
            className={styles.sendBtn}
            onClick={handleSend}
            disabled={!newMessage.trim() || sending}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
