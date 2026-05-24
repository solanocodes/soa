import cron from 'node-cron';
import { query } from '../config/database';
import { sendPushNotification } from './notifications';
import { generateCoachResponse, generateWeeklyReport, generatePremarketBrief } from './ai';

export function startAutomationEngine() {
  console.log('Starting automation engine...');

  // Run every 5 minutes - process pending automation events
  cron.schedule('*/5 * * * *', async () => {
    try {
      await processAutomationQueue();
    } catch (error) {
      console.error('Automation queue processing error:', error);
    }
  });

  // Run every 5 minutes - check behavioral triggers
  cron.schedule('*/5 * * * *', async () => {
    try {
      await checkBehavioralTriggers();
    } catch (error) {
      console.error('Behavioral triggers error:', error);
    }
  });

  // Run daily at 7:00 AM ET - pre-market brief
  cron.schedule('0 11 * * 1-5', async () => {
    // 11:00 UTC = 7:00 AM ET
    try {
      await sendPremarketBriefs();
    } catch (error) {
      console.error('Premarket briefs error:', error);
    }
  });

  // Run every Monday at 7:00 AM ET - weekly report
  cron.schedule('0 11 * * 1', async () => {
    try {
      await sendWeeklyReports();
    } catch (error) {
      console.error('Weekly reports error:', error);
    }
  });

  // Run daily - check revenue automations
  cron.schedule('0 14 * * *', async () => {
    try {
      await checkRevenueAutomations();
    } catch (error) {
      console.error('Revenue automations error:', error);
    }
  });

  console.log('Automation engine started with scheduled jobs.');
}

async function processAutomationQueue() {
  const pendingEvents = await query(
    `SELECT * FROM automation_events
     WHERE status = 'pending' AND scheduled_for <= NOW()
     ORDER BY scheduled_for ASC
     LIMIT 50`
  );

  for (const event of pendingEvents.rows) {
    try {
      await query(
        "UPDATE automation_events SET status = 'processing' WHERE id = $1",
        [event.id]
      );

      switch (event.action_type) {
        case 'send_dm':
          await executeSendDM(event);
          break;
        case 'send_push':
          await executeSendPush(event);
          break;
        case 'send_email':
          await executeSendEmail(event);
          break;
        case 'upgrade_prompt':
          await executeUpgradePrompt(event);
          break;
        default:
          console.warn(`Unknown action_type: ${event.action_type}`);
      }

      await query(
        "UPDATE automation_events SET status = 'completed', processed_at = NOW() WHERE id = $1",
        [event.id]
      );
    } catch (error: any) {
      console.error(`Error processing automation event ${event.id}:`, error);
      await query(
        "UPDATE automation_events SET status = 'failed', error_message = $1, processed_at = NOW() WHERE id = $2",
        [error.message, event.id]
      );
    }
  }
}

async function checkBehavioralTriggers() {
  // Check for inactive users (no activity in 3+ days, has paid tier)
  const inactiveUsers = await query(
    `SELECT id, username, display_name, email, tier FROM users
     WHERE last_active_at < NOW() - INTERVAL '3 days'
       AND tier != 'FREE'
       AND is_admin = FALSE AND is_coach = FALSE
       AND id NOT IN (
         SELECT user_id FROM automation_events
         WHERE trigger_type = 'inactive_user'
           AND created_at > NOW() - INTERVAL '7 days'
           AND user_id IS NOT NULL
       )`
  );

  for (const user of inactiveUsers.rows) {
    await query(
      `INSERT INTO automation_events (user_id, trigger_type, trigger_data, action_type, action_data, scheduled_for)
       VALUES ($1, 'inactive_user', $2, 'send_dm', $3, NOW())`,
      [
        user.id,
        JSON.stringify({ days_inactive: 3, tier: user.tier }),
        JSON.stringify({ message_template: 'inactive_checkin', display_name: user.display_name }),
      ]
    );
  }

  // Check for loss streaks (3+ consecutive losses)
  const lossStreakUsers = await query(
    `SELECT us.user_id, u.display_name, us.current_streak FROM user_stats us
     JOIN users u ON u.id = us.user_id
     WHERE us.current_streak <= -3
       AND us.user_id NOT IN (
         SELECT user_id FROM automation_events
         WHERE trigger_type = 'loss_streak'
           AND created_at > NOW() - INTERVAL '1 day'
           AND user_id IS NOT NULL
       )`
  );

  for (const user of lossStreakUsers.rows) {
    await query(
      `INSERT INTO automation_events (user_id, trigger_type, trigger_data, action_type, action_data, scheduled_for)
       VALUES ($1, 'loss_streak', $2, 'send_dm', $3, NOW())`,
      [
        user.user_id,
        JSON.stringify({ streak: user.current_streak }),
        JSON.stringify({ message_template: 'loss_support', display_name: user.display_name }),
      ]
    );
  }

  // Check for win streaks (5+ consecutive wins) - celebrate!
  const winStreakUsers = await query(
    `SELECT us.user_id, u.display_name, us.current_streak FROM user_stats us
     JOIN users u ON u.id = us.user_id
     WHERE us.current_streak >= 5
       AND us.user_id NOT IN (
         SELECT user_id FROM automation_events
         WHERE trigger_type = 'win_streak'
           AND created_at > NOW() - INTERVAL '7 days'
           AND user_id IS NOT NULL
       )`
  );

  for (const user of winStreakUsers.rows) {
    await query(
      `INSERT INTO automation_events (user_id, trigger_type, trigger_data, action_type, action_data, scheduled_for)
       VALUES ($1, 'win_streak', $2, 'send_dm', $3, NOW())`,
      [
        user.user_id,
        JSON.stringify({ streak: user.current_streak }),
        JSON.stringify({ message_template: 'win_celebration', display_name: user.display_name }),
      ]
    );
  }
}

async function checkRevenueAutomations() {
  // Expiring subscriptions (7 days before expiry)
  const expiringUsers = await query(
    `SELECT id, email, display_name, tier, subscription_expires_at FROM users
     WHERE subscription_expires_at BETWEEN NOW() AND NOW() + INTERVAL '7 days'
       AND subscription_status = 'active'
       AND id NOT IN (
         SELECT user_id FROM automation_events
         WHERE trigger_type = 'subscription_expiring'
           AND created_at > NOW() - INTERVAL '7 days'
           AND user_id IS NOT NULL
       )`
  );

  for (const user of expiringUsers.rows) {
    await query(
      `INSERT INTO automation_events (user_id, trigger_type, trigger_data, action_type, action_data, scheduled_for)
       VALUES ($1, 'subscription_expiring', $2, 'send_push', $3, NOW())`,
      [
        user.id,
        JSON.stringify({ expires_at: user.subscription_expires_at, tier: user.tier }),
        JSON.stringify({ title: 'Subscription Expiring', body: 'Your subscription expires soon. Renew to keep access!' }),
      ]
    );
  }

  // Failed payments
  const failedPayments = await query(
    `SELECT u.id, u.email, u.display_name FROM users u
     WHERE u.subscription_status = 'past_due'
       AND u.id NOT IN (
         SELECT user_id FROM automation_events
         WHERE trigger_type = 'failed_payment'
           AND created_at > NOW() - INTERVAL '3 days'
           AND user_id IS NOT NULL
       )`
  );

  for (const user of failedPayments.rows) {
    await query(
      `INSERT INTO automation_events (user_id, trigger_type, trigger_data, action_type, action_data, scheduled_for)
       VALUES ($1, 'failed_payment', $2, 'send_push', $3, NOW())`,
      [
        user.id,
        JSON.stringify({ status: 'past_due' }),
        JSON.stringify({ title: 'Payment Issue', body: 'We had trouble processing your payment. Please update your billing info.' }),
      ]
    );
  }
}

async function sendPremarketBriefs() {
  const users = await query(
    `SELECT id FROM users
     WHERE tier != 'FREE' AND is_admin = FALSE
       AND notification_preferences->>'marketing' = 'true'
       AND last_active_at > NOW() - INTERVAL '7 days'`
  );

  for (const user of users.rows) {
    try {
      const brief = await generatePremarketBrief(user.id);
      if (brief) {
        await sendPushNotification(user.id, 'Pre-Market Brief 📊', brief.substring(0, 200), { type: 'premarket_brief' });
      }
    } catch (error) {
      console.error(`Error sending premarket brief to ${user.id}:`, error);
    }
  }
}

async function sendWeeklyReports() {
  const users = await query(
    `SELECT id FROM users
     WHERE tier != 'FREE' AND is_admin = FALSE
       AND id IN (SELECT DISTINCT user_id FROM journal_entries WHERE trade_date >= CURRENT_DATE - INTERVAL '7 days')`
  );

  for (const user of users.rows) {
    try {
      const report = await generateWeeklyReport(user.id);
      if (report) {
        // Find or create DM thread with admin
        const admin = await query("SELECT id FROM users WHERE email = 'sean@simplyoptionsacademy.com'");
        if (admin.rows.length > 0) {
          let thread = await query(
            `SELECT id FROM direct_message_threads
             WHERE (participant_1 = $1 AND participant_2 = $2) OR (participant_1 = $2 AND participant_2 = $1)`,
            [admin.rows[0].id, user.id]
          );

          if (thread.rows.length === 0) {
            thread = await query(
              `INSERT INTO direct_message_threads (participant_1, participant_2, ai_mode)
               VALUES ($1, $2, 'off') RETURNING id`,
              [admin.rows[0].id, user.id]
            );
          }

          await query(
            `INSERT INTO direct_messages (thread_id, sender_id, content, is_ai_generated, ai_approved)
             VALUES ($1, $2, $3, TRUE, TRUE)`,
            [thread.rows[0].id, admin.rows[0].id, `📊 **Your Weekly Report**\n\n${report}`]
          );
        }
      }
    } catch (error) {
      console.error(`Error sending weekly report to ${user.id}:`, error);
    }
  }
}

async function executeSendDM(event: any) {
  const actionData = event.action_data;
  const admin = await query("SELECT id FROM users WHERE email = 'sean@simplyoptionsacademy.com'");
  if (admin.rows.length === 0) return;

  // Find or create DM thread
  let thread = await query(
    `SELECT id FROM direct_message_threads
     WHERE (participant_1 = $1 AND participant_2 = $2) OR (participant_1 = $2 AND participant_2 = $1)`,
    [admin.rows[0].id, event.user_id]
  );

  if (thread.rows.length === 0) {
    thread = await query(
      `INSERT INTO direct_message_threads (participant_1, participant_2, ai_mode)
       VALUES ($1, $2, 'draft') RETURNING id`,
      [admin.rows[0].id, event.user_id]
    );
  }

  let message = '';
  switch (actionData.message_template) {
    case 'inactive_checkin':
      message = `Hey ${actionData.display_name}! Haven't seen you around in a few days. Everything good? The market's been moving and I don't want you to miss out on the setups we've been sharing. Jump back in when you're ready! 💪`;
      break;
    case 'loss_support':
      message = `Hey ${actionData.display_name}, I noticed you've had a rough stretch. That's part of the game. Take a breath, review your journal, and remember - one bad week doesn't define your trading career. Hit me up if you want to go over your trades together.`;
      break;
    case 'win_celebration':
      message = `${actionData.display_name}! 🔥 You're on a serious streak right now. Love to see the consistency. Keep managing your risk and don't let the wins make you overlever. You're in the zone!`;
      break;
    default:
      message = `Hey ${actionData.display_name}! Just checking in. How's your trading going?`;
  }

  // Generate AI-enhanced version
  const aiMessage = await generateCoachResponse(
    `Generate a personalized message for template: ${actionData.message_template}. Student name: ${actionData.display_name}`,
    []
  );

  await query(
    `INSERT INTO direct_messages (thread_id, sender_id, content, is_ai_generated, ai_approved)
     VALUES ($1, $2, $3, TRUE, NULL)`,
    [thread.rows[0].id, admin.rows[0].id, aiMessage || message]
  );
}

async function executeSendPush(event: any) {
  const actionData = event.action_data;
  await sendPushNotification(
    event.user_id,
    actionData.title,
    actionData.body,
    actionData.data || {}
  );
}

async function executeSendEmail(event: any) {
  const actionData = event.action_data;
  if (!process.env.RESEND_API_KEY) return;

  const user = await query('SELECT email, display_name FROM users WHERE id = $1', [event.user_id]);
  if (user.rows.length === 0) return;

  const { Resend } = require('resend');
  const resend = new Resend(process.env.RESEND_API_KEY);

  await resend.emails.send({
    from: 'SOA <noreply@simplyoptionsacademy.com>',
    to: user.rows[0].email,
    subject: actionData.subject || 'Simply Options Academy',
    html: actionData.html || `<p>${actionData.body}</p>`,
  });
}

async function executeUpgradePrompt(event: any) {
  await sendPushNotification(
    event.user_id,
    'Unlock More Features 🚀',
    'Upgrade your plan to access alerts, live sessions, and the full course library!',
    { type: 'upgrade_prompt' }
  );
}
