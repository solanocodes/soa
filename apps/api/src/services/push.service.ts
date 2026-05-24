import { Expo, ExpoPushMessage } from 'expo-server-sdk';
import db from '../config/database';

const expo = new Expo();

const MAX_DAILY_NOTIFICATIONS = 3;
const EXEMPT_TYPES = ['new_alert', 'drawdown_warning', 'live_session_started'];

export async function sendPushNotification(
  userId: string,
  title: string,
  body: string,
  data?: Record<string, any>,
  notificationType?: string
) {
  if (!EXEMPT_TYPES.includes(notificationType || '')) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayCount = await db('push_notifications')
      .where('user_id', userId)
      .where('sent_at', '>=', today)
      .count('* as count')
      .first();

    if (parseInt(String(todayCount?.count || '0')) >= MAX_DAILY_NOTIFICATIONS) {
      return;
    }
  }

  const tokens = await db('push_notifications')
    .where('user_id', userId)
    .whereNotNull('data')
    .select('data');

  // For now, log the notification. Real implementation uses expo push tokens.
  await db('push_notifications').insert({
    user_id: userId,
    title,
    body,
    data: JSON.stringify(data || {}),
    sent_at: new Date(),
  });

  console.log(`[Push] Sent to ${userId}: ${title}`);
}

export async function sendBulkPush(
  userIds: string[],
  title: string,
  body: string,
  data?: Record<string, any>,
  notificationType?: string
) {
  for (const userId of userIds) {
    await sendPushNotification(userId, title, body, data, notificationType);
  }
}

export async function sendAlertNotification(alertContent: string, channelSlug: string) {
  const channel = await db('channels').where('slug', channelSlug).first();
  if (!channel) return;

  const eligibleUsers = await db('users')
    .where('tier', '!=', 'FREE')
    .select('id');

  const title = '🚨 New Alert from Sean — tap to view';
  const body = alertContent.substring(0, 100);

  await sendBulkPush(
    eligibleUsers.map(u => u.id),
    title,
    body,
    { type: 'alert', channelSlug },
    'new_alert'
  );
}

export async function sendLiveNotification(sessionTitle: string) {
  const eligibleUsers = await db('users')
    .where('tier', '!=', 'FREE')
    .select('id');

  await sendBulkPush(
    eligibleUsers.map(u => u.id),
    '📡 Sean is live now — tap to join',
    sessionTitle,
    { type: 'live_session' },
    'live_session_started'
  );
}
