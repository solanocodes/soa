export interface Message {
  id: string;
  channel_id: string;
  user_id: string;
  content: string;
  message_type: 'text' | 'alert' | 'win' | 'system' | 'ai';
  is_pinned: boolean;
  is_deleted: boolean;
  reply_to_id: string | null;
  created_at: string;
  updated_at: string;
  author?: MessageAuthor;
  attachments?: MessageAttachment[];
  reactions?: MessageReaction[];
  reply_to?: Message | null;
}

export interface MessageAuthor {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  is_admin: boolean;
  is_coach: boolean;
}

export interface MessageAttachment {
  id: string;
  message_id: string;
  file_url: string;
  file_name: string | null;
  file_type: string | null;
  file_size: number | null;
  width: number | null;
  height: number | null;
}

export interface MessageReaction {
  emoji: string;
  count: number;
  users: string[];
  has_reacted: boolean;
}

export interface SendMessageInput {
  channel_id: string;
  content: string;
  reply_to_id?: string;
  attachments?: File[];
}
