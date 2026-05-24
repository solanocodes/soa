export interface Alert {
  id: string;
  author_id: string;
  content: string;
  ticker: string | null;
  direction: string | null;
  entry_price: number | null;
  target_price: number | null;
  stop_price: number | null;
  result_ticks: number | null;
  alert_type: 'trade' | 'trim' | 'target' | 'stop' | 'commentary' | 'morning' | 'warning';
  channel_slug: string;
  has_image: boolean;
  image_url: string | null;
  is_historical: boolean;
  original_discord_id: string | null;
  original_timestamp: string | null;
  created_at: string;
  author?: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
}

export interface AlertFilters {
  channel_slug?: string;
  alert_type?: string;
  ticker?: string;
  cursor?: string;
  limit?: number;
}
