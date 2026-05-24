import type { Tier } from '../constants/tiers';

export interface Channel {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  category: string;
  channel_type: 'text' | 'voice' | 'alerts' | 'journal';
  required_tier: Tier;
  position: number;
  is_active: boolean;
  created_at: string;
}

export interface ChannelWithUnread extends Channel {
  unread_count: number;
  last_message_at: string | null;
}
