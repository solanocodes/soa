export interface DirectMessageThread {
  id: string;
  student_id: string;
  coach_id: string;
  ai_mode: 'suggest' | 'autopilot' | 'off';
  last_message_at: string;
  created_at: string;
  other_user?: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
  last_message?: DirectMessage | null;
  unread_count?: number;
}

export interface DirectMessage {
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
