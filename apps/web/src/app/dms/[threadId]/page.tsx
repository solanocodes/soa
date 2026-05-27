'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { connectSocket } from '@/lib/socket';
import { useAuthStore } from '@/lib/store';
import { getRelativeTime, getInitials } from '@/lib/utils';
import styles from './page.module.css';

interface DmMessage {
  id: string;
  thread_id: string;
  sender_id: string;
  content: string;
  is_ai_generated: boolean;
  ai_confidence: number | null;
  was_edited_before_send: boolean;
  is_read: boolean;
  created_at: string;
  sender?: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
}

interface AiSuggestion {
  id: string;
  thread_id: string;
  content: string;
  ai_confidence: number;
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

  // AI suggestion state
  const [suggestions, setSuggestions] = useState<AiSuggestion[]>([]);
  const [editingSuggestionId, setEditingSuggestionId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [processingAction, setProcessingAction] = useState<string | null>(null);

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

  // Fetch AI suggestions (only for coach/admin)
  const fetchSuggestions = useCallback(() => {
    if (!threadId || !user?.is_coach && !user?.is_admin) return;

    api
      .get(`/dms/threads/${threadId}/ai-suggestions`)
      .then(({ data }) => {
        setSuggestions(data.suggestions ?? []);
      })
      .catch(() => {
        // Silently fail - user might be a student
      });
  }, [threadId, user?.is_coach, user?.is_admin]);

  useEffect(() => {
    fetchSuggestions();
  }, [fetchSuggestions]);

  // Poll for new suggestions every 10 seconds
  useEffect(() => {
    if (!user?.is_coach && !user?.is_admin) return;
    const interval = setInterval(fetchSuggestions, 10000);
    return () => clearInterval(interval);
  }, [fetchSuggestions, user?.is_coach, user?.is_admin]);

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
        // Refresh suggestions when a new message arrives
        fetchSuggestions();
      }
    };

    socket.on('new_dm', handleNewDm);

    return () => {
      socket.emit('leave_dm', { thread_id: threadId });
      socket.off('new_dm', handleNewDm);
    };
  }, [threadId, fetchSuggestions]);

  const handleSend = async () => {
    if (!newMessage.trim() || sending) return;
    setSending(true);
    try {
      const { data } = await api.post(`/dms/threads/${threadId}/messages`, {
        content: newMessage.trim(),
      });
      setMessages((prev) => [...prev, data.message]);
      setNewMessage('');
      // Refresh suggestions after sending (student message triggers AI)
      setTimeout(fetchSuggestions, 2000);
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

  // AI suggestion actions
  const handleApproveSuggestion = async (suggestionId: string) => {
    setProcessingAction(suggestionId);
    try {
      const { data } = await api.post(`/dms/threads/${threadId}/ai-suggestions`, {
        action: 'approve',
        suggestion_id: suggestionId,
      });
      setSuggestions((prev) => prev.filter((s) => s.id !== suggestionId));
      if (data.message) {
        setMessages((prev) => [...prev, data.message]);
      }
    } catch {
      // handle error
    } finally {
      setProcessingAction(null);
    }
  };

  const handleEditSuggestion = (suggestion: AiSuggestion) => {
    setEditingSuggestionId(suggestion.id);
    setEditContent(suggestion.content);
  };

  const handleSendEdited = async () => {
    if (!editingSuggestionId || !editContent.trim()) return;
    setProcessingAction(editingSuggestionId);
    try {
      const { data } = await api.post(`/dms/threads/${threadId}/ai-suggestions`, {
        action: 'edit',
        suggestion_id: editingSuggestionId,
        content: editContent.trim(),
      });
      setSuggestions((prev) => prev.filter((s) => s.id !== editingSuggestionId));
      if (data.message) {
        setMessages((prev) => [...prev, data.message]);
      }
      setEditingSuggestionId(null);
      setEditContent('');
    } catch {
      // handle error
    } finally {
      setProcessingAction(null);
    }
  };

  const handleRejectSuggestion = async (suggestionId: string) => {
    setProcessingAction(suggestionId);
    try {
      await api.post(`/dms/threads/${threadId}/ai-suggestions`, {
        action: 'reject',
        suggestion_id: suggestionId,
      });
      setSuggestions((prev) => prev.filter((s) => s.id !== suggestionId));
    } catch {
      // handle error
    } finally {
      setProcessingAction(null);
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

  const isCoachOrAdmin = user?.is_coach || user?.is_admin;

  return (
    <div className={styles.container}>
      <div className={styles.feed}>
        {messages.length === 0 && (
          <div className={styles.centerState}>
            <span>No messages yet. Say hello!</span>
          </div>
        )}

        {messages.map((msg) => {
          const senderName = msg.sender?.display_name || msg.sender?.username || 'Unknown';
          const avatarUrl = msg.sender?.avatar_url;
          const isStaff = msg.sender_id === user?.id && (user?.is_admin || user?.is_coach);
          return (
            <div key={msg.id} className={styles.message}>
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className={styles.messageAvatar} style={{ objectFit: 'cover' }} />
              ) : (
                <div className={styles.messageAvatar} style={{ background: '#4ECDC4' }}>
                  {getInitials(senderName)}
                </div>
              )}
              <div className={styles.messageBody}>
                <div className={styles.messageHeader}>
                  <span className={`${styles.authorName} ${isStaff ? styles.authorStaff : ''}`}>
                    {senderName}
                  </span>
                  {msg.is_ai_generated && <span className={styles.aiBadge}>AI</span>}
                  <span className={styles.timestamp}>{getRelativeTime(msg.created_at)}</span>
                </div>
                <div className={styles.messageContent}>{msg.content}</div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* AI Suggestions Panel - only visible to coach/admin */}
      {isCoachOrAdmin && suggestions.length > 0 && (
        <div className={styles.suggestionsPanel}>
          <div className={styles.suggestionsPanelHeader}>
            AI Suggested Responses
          </div>
          {suggestions.map((suggestion) => (
            <div key={suggestion.id} className={styles.suggestionCard}>
              {editingSuggestionId === suggestion.id ? (
                <div className={styles.suggestionEditArea}>
                  <textarea
                    className={styles.suggestionEditInput}
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    rows={3}
                  />
                  <div className={styles.suggestionActions}>
                    <button
                      className={styles.btnSendEdited}
                      onClick={handleSendEdited}
                      disabled={processingAction === suggestion.id}
                    >
                      Send Edited
                    </button>
                    <button
                      className={styles.btnCancel}
                      onClick={() => {
                        setEditingSuggestionId(null);
                        setEditContent('');
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className={styles.suggestionContent}>
                    {suggestion.content}
                  </div>
                  <div className={styles.suggestionMeta}>
                    <span className={styles.confidenceBadge}>
                      {Math.round((suggestion.ai_confidence || 0) * 100)}% confidence
                    </span>
                  </div>
                  <div className={styles.suggestionActions}>
                    <button
                      className={styles.btnApprove}
                      onClick={() => handleApproveSuggestion(suggestion.id)}
                      disabled={processingAction === suggestion.id}
                    >
                      Approve
                    </button>
                    <button
                      className={styles.btnEdit}
                      onClick={() => handleEditSuggestion(suggestion)}
                      disabled={processingAction === suggestion.id}
                    >
                      Edit
                    </button>
                    <button
                      className={styles.btnReject}
                      onClick={() => handleRejectSuggestion(suggestion.id)}
                      disabled={processingAction === suggestion.id}
                    >
                      Reject
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}

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
