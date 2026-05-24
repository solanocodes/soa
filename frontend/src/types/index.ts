export type Tier = 'FREE' | 'CORE' | 'WEALTH' | 'BOT';

export interface User {
  id: string;
  email: string;
  username: string;
  displayName: string;
  avatar?: string;
  tier: Tier;
  referralCode: string;
  referredBy?: string;
  propFirmAccounts: PropFirmAccount[];
  stats: UserStats;
  createdAt: string;
  updatedAt: string;
}

export interface UserStats {
  totalTrades: number;
  winRate: number;
  totalPnL: number;
  currentStreak: number;
  bestStreak: number;
  journalEntries: number;
  coursesCompleted: number;
}

export interface Channel {
  id: string;
  name: string;
  slug: string;
  description?: string;
  emoji?: string;
  category: string;
  tier: Tier;
  memberCount: number;
  unreadCount: number;
  lastMessage?: Message;
  isLocked: boolean;
  createdAt: string;
}

export interface Message {
  id: string;
  channelId: string;
  author: MessageAuthor;
  content: string;
  attachments: Attachment[];
  reactions: Reaction[];
  replyTo?: string;
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MessageAuthor {
  id: string;
  username: string;
  displayName: string;
  avatar?: string;
  tier: Tier;
  isAdmin: boolean;
}

export interface Attachment {
  id: string;
  type: 'image' | 'video' | 'file';
  url: string;
  thumbnailUrl?: string;
  filename: string;
  size: number;
}

export interface Reaction {
  emoji: string;
  count: number;
  userIds: string[];
}

export interface Alert {
  id: string;
  author: MessageAuthor;
  content: string;
  ticker?: string;
  direction?: 'LONG' | 'SHORT';
  entryPrice?: number;
  targetPrice?: number;
  stopLoss?: number;
  attachments: Attachment[];
  category: 'solano' | 'demon' | 'bryce' | 'options' | 'bot';
  createdAt: string;
}

export interface JournalEntry {
  id: string;
  userId: string;
  ticker: string;
  direction: 'LONG' | 'SHORT';
  entryPrice: number;
  exitPrice: number;
  positionSize: number;
  pnl: number;
  pnlPercentage: number;
  setupType: string;
  notes?: string;
  emotions: string[];
  screenshots: Attachment[];
  coachReviewed: boolean;
  coachNotes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Win {
  id: string;
  userId: string;
  user: MessageAuthor;
  caption: string;
  pnl: number;
  screenshot?: Attachment;
  verified: boolean;
  likes: number;
  createdAt: string;
}

export interface Course {
  id: string;
  title: string;
  description: string;
  thumbnail?: string;
  tier: Tier;
  modules: CourseModule[];
  totalDuration: number;
  enrolledCount: number;
  progress?: number;
  isLocked: boolean;
  createdAt: string;
}

export interface CourseModule {
  id: string;
  courseId: string;
  title: string;
  description?: string;
  videoUrl?: string;
  duration: number;
  order: number;
  isCompleted: boolean;
}

export interface DirectMessageThread {
  id: string;
  participants: MessageAuthor[];
  lastMessage?: DirectMessage;
  unreadCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface DirectMessage {
  id: string;
  threadId: string;
  author: MessageAuthor;
  content: string;
  attachments: Attachment[];
  readAt?: string;
  createdAt: string;
}

export interface LiveSession {
  id: string;
  title: string;
  description?: string;
  host: MessageAuthor;
  scheduledAt: string;
  startedAt?: string;
  endedAt?: string;
  isLive: boolean;
  viewerCount: number;
  tier: Tier;
  recordingUrl?: string;
}

export interface PropFirmAccount {
  id: string;
  userId: string;
  firmName: string;
  accountSize: number;
  currentBalance: number;
  profitTarget: number;
  maxDrawdown: number;
  phase: 'challenge' | 'verification' | 'funded';
  status: 'active' | 'passed' | 'failed';
  startDate: string;
  endDate?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface ApiError {
  message: string;
  code: string;
  statusCode: number;
}
