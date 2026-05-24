'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { connectSocket } from '@/lib/socket';
import { useAuthStore } from '@/lib/store';
import { getRelativeTime } from '@/lib/utils';
import styles from './page.module.css';

interface DmMessage {
  id: string;
  thread_id: string;
  sender_id: string;
  content: string;
  is_ai: boolean;
  created_at: string;
}

export default function DmChatPage() {
  const params = useParams();
  const threadId = params.threadId as string;
  const user = useAuthStore((s) => s.user);

  const [messages, setMessages] = useState<DmMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Fetch messages
  useEffect(() => {
    if (!threadId) return;
    setLoading(true);
    setError(null);

    api
      .get(`/dms/threads/${threadId}/messages`)
      .then(({ data }) => {
        const msgs: DmMessage[] = data.messages ?? data;
        setMessages(msgs);
      })
      .catch(() => setError('Failed to load messages'))
      .finally(() => setLoading(false));
  }, [threadId]);

  // Auto scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Socket
  useEffect(() => {
    if (!threadId) return;
    const socket = connectSocket();

    socket.emit('join_dm', { thread_id: threadId });

    const handleNewDm = (msg: DmMessage) => {
      if (msg.thread_id === threadId) {
        setMessages((prev) => [...prev, msg]);
      }
    };

    socket.on('new_dm', handleNewDm);

    return () => {
      socket.emit('leave_dm', { thread_id: threadId });
      socket.off('new_dm', handleNewDm);
    };
  }, [threadId]);

  const handleSend = async () => {
    if (!newMessage.trim() || sending) return;
    setSending(true);
    try {
      await api.post(`/dms/threads/${threadId}/messages`, {
        content: newMessage.trim(),
      });
      setNewMessage('');
    } catch {
      // handle error
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.centerState}>
          <div className={styles.spinner} />
          <span>Loading messages...</span>
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
      <div className={styles.feed}>
        {messages.length === 0 && (
          <div className={styles.centerState}>
            <span>No messages yet. Say hello!</span>
          </div>
        )}

        {messages.map((msg) => {
          const isSent = msg.sender_id === user?.id;
          return (
            <div
              key={msg.id}
              className={`${styles.messageRow} ${
                isSent ? styles.messageRowSent : styles.messageRowReceived
              }`}
            >
              <div
                className={`${styles.bubble} ${
                  isSent ? styles.bubbleSent : styles.bubbleReceived
                }`}
              >
                {msg.is_ai && <div className={styles.aiBadge}>AI</div>}
                {msg.content}
                <span className={styles.bubbleTime}>
                  {getRelativeTime(msg.created_at)}
                </span>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div className={styles.inputArea}>
        <div className={styles.inputRow}>
          <input
            className={styles.textInput}
            type="text"
            placeholder="Type a message..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
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
