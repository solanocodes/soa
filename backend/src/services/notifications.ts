import { query } from '../config/database';

export async function sendPushNotification(
  userId: string,
  title: string,
  body: string,
  data?: Record<string, any>
): Promise<void> {
  try {
    // Log to database
    await query(
      `INSERT INTO push_notifications (user_id, title, body, data, is_sent, sent_at)
       VALUES ($1, $2, $3, $4, TRUE, NOW())`,
      [userId, title, body, data ? JSON.stringify(data) : null]
    );

    // Get user's push token
    const user = await query(
      'SELECT push_token, notification_preferences FROM users WHERE id = $1',
      [userId]
    );

    if (user.rows.length === 0 || !user.rows[0].push_token) return;

    // Check notification preferences
    const prefs = user.rows[0].notification_preferences;
    if (data?.type) {
      const typeMap: Record<string, string> = {
        'alert': 'alerts',
        'new_alert': 'alerts',
        'dm': 'dms',
        'win_verified': 'wins',
        'live_session': 'live',
        'premarket_brief': 'marketing',
        'upgrade_prompt': 'marketing',
      };
      const prefKey = typeMap[data.type];
      if (prefKey && prefs && prefs[prefKey] === false) return;
    }

    // Send via OneSignal if configured
    if (process.env.ONESIGNAL_APP_ID && process.env.ONESIGNAL_API_KEY) {
      await fetch('https://onesignal.com/api/v1/notifications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${process.env.ONESIGNAL_API_KEY}`,
        },
        body: JSON.stringify({
          app_id: process.env.ONESIGNAL_APP_ID,
          include_player_ids: [user.rows[0].push_token],
          headings: { en: title },
          contents: { en: body },
          data: data || {},
        }),
      });
    }
  } catch (error) {
    console.error('Push notification error:', error);
  }
}

export async function sendBulkPushNotification(
  title: string,
  body: string,
  data?: Record<string, any>,
  preferenceKey?: string
): Promise<void> {
  try {
    // Get all users with push tokens
    let usersQuery = 'SELECT id, push_token, notification_preferences FROM users WHERE push_token IS NOT NULL';

    if (preferenceKey) {
      usersQuery += ` AND (notification_preferences->>'${preferenceKey}')::boolean = TRUE`;
    }

    const users = await query(usersQuery);

    for (const user of users.rows) {
      // Log each notification
      await query(
        `INSERT INTO push_notifications (user_id, title, body, data, is_sent, sent_at)
         VALUES ($1, $2, $3, $4, TRUE, NOW())`,
        [user.id, title, body, data ? JSON.stringify(data) : null]
      );
    }

    // Bulk send via OneSignal
    if (process.env.ONESIGNAL_APP_ID && process.env.ONESIGNAL_API_KEY) {
      const playerIds = users.rows.map((u: any) => u.push_token).filter(Boolean);

      if (playerIds.length > 0) {
        // OneSignal supports batches of 2000
        for (let i = 0; i < playerIds.length; i += 2000) {
          const batch = playerIds.slice(i, i + 2000);
          await fetch('https://onesignal.com/api/v1/notifications', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Basic ${process.env.ONESIGNAL_API_KEY}`,
            },
            body: JSON.stringify({
              app_id: process.env.ONESIGNAL_APP_ID,
              include_player_ids: batch,
              headings: { en: title },
              contents: { en: body },
              data: data || {},
            }),
          });
        }
      }
    }
  } catch (error) {
    console.error('Bulk push notification error:', error);
  }
}
