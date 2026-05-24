import cron from 'node-cron';
import db from '../config/database';

export function startJobRunner() {
  // Check for pending automation events every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    try {
      const pendingEvents = await db('automation_events')
        .where('status', 'pending')
        .where('scheduled_for', '<=', new Date())
        .limit(50);

      for (const event of pendingEvents) {
        try {
          await executeEvent(event);
          await db('automation_events')
            .where('id', event.id)
            .update({ status: 'executed', executed_at: new Date() });
        } catch (err) {
          console.error(`Failed to execute event ${event.id}:`, err);
          await db('automation_events')
            .where('id', event.id)
            .update({ status: 'failed' });
        }
      }
    } catch (err) {
      console.error('Job runner error:', err);
    }
  });

  // Daily behavioral triggers check at 8am
  cron.schedule('0 8 * * *', async () => {
    try {
      await checkInactiveUsers();
    } catch (err) {
      console.error('Behavioral trigger error:', err);
    }
  });

  // Weekly report - Monday 7am
  cron.schedule('0 7 * * 1', async () => {
    try {
      await generateWeeklyReports();
    } catch (err) {
      console.error('Weekly report error:', err);
    }
  });

  console.log('Job runner started');
}

async function executeEvent(event: any) {
  const { event_type, user_id, payload } = event;

  switch (event_type) {
    case 'onboarding_welcome':
      // Send welcome DM
      console.log(`[Automation] Welcome message for user ${user_id}`);
      break;
    case 'onboarding_module1':
      // Push notification to start module 1
      console.log(`[Automation] Module 1 prompt for user ${user_id}`);
      break;
    case 'onboarding_checkin':
      // Check-in DM
      console.log(`[Automation] Day 3 check-in for user ${user_id}`);
      break;
    case 'onboarding_week1':
      // Week 1 summary
      console.log(`[Automation] Week 1 summary for user ${user_id}`);
      break;
    case 'onboarding_month1':
      // Month 1 milestone
      console.log(`[Automation] Month 1 milestone for user ${user_id}`);
      break;
    case 'inactive_reminder':
      // Push notification for inactive user
      console.log(`[Automation] Inactive reminder for user ${user_id}`);
      break;
    default:
      console.log(`[Automation] Unknown event type: ${event_type}`);
  }
}

async function checkInactiveUsers() {
  const threeDaysAgo = new Date();
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const fourteenDaysAgo = new Date();
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

  // 3 day inactive - push notification
  const inactive3 = await db('users')
    .where('last_active_at', '<', threeDaysAgo)
    .where('last_active_at', '>=', sevenDaysAgo)
    .where('tier', '!=', 'FREE')
    .select('id');

  for (const user of inactive3) {
    await db('automation_events').insert({
      user_id: user.id,
      event_type: 'inactive_reminder',
      scheduled_for: new Date(),
      payload: JSON.stringify({ days_inactive: 3, message: 'We miss you — markets are moving' }),
    });
  }

  // 7 day inactive - AI DM
  const inactive7 = await db('users')
    .where('last_active_at', '<', sevenDaysAgo)
    .where('last_active_at', '>=', fourteenDaysAgo)
    .where('tier', '!=', 'FREE')
    .select('id');

  for (const user of inactive7) {
    await db('automation_events').insert({
      user_id: user.id,
      event_type: 'inactive_ai_dm',
      scheduled_for: new Date(),
      payload: JSON.stringify({ days_inactive: 7 }),
    });
  }

  // 14 day inactive - flag for personal outreach
  const inactive14 = await db('users')
    .where('last_active_at', '<', fourteenDaysAgo)
    .where('tier', '!=', 'FREE')
    .select('id');

  for (const user of inactive14) {
    await db('automation_events').insert({
      user_id: user.id,
      event_type: 'inactive_personal_outreach',
      scheduled_for: new Date(),
      payload: JSON.stringify({ days_inactive: 14 }),
    });
  }

  console.log(`[Behavioral] Checked: ${inactive3.length} (3d), ${inactive7.length} (7d), ${inactive14.length} (14d) inactive users`);
}

async function generateWeeklyReports() {
  const activeUsers = await db('users')
    .where('tier', '!=', 'FREE')
    .where('onboarding_completed', true)
    .select('id');

  for (const user of activeUsers) {
    await db('automation_events').insert({
      user_id: user.id,
      event_type: 'weekly_report',
      scheduled_for: new Date(),
      payload: JSON.stringify({}),
    });
  }

  console.log(`[Weekly] Queued ${activeUsers.length} weekly reports`);
}

export function scheduleOnboarding(userId: string) {
  const now = new Date();
  const events = [
    { day: 0, type: 'onboarding_welcome' },
    { day: 1, type: 'onboarding_module1' },
    { day: 2, type: 'onboarding_checkin' },
    { day: 6, type: 'onboarding_week1' },
    { day: 11, type: 'onboarding_cohort' },
    { day: 29, type: 'onboarding_month1' },
  ];

  return Promise.all(
    events.map(({ day, type }) => {
      const scheduledFor = new Date(now);
      scheduledFor.setDate(scheduledFor.getDate() + day);
      scheduledFor.setHours(9, 0, 0, 0);

      return db('automation_events').insert({
        user_id: userId,
        event_type: type,
        scheduled_for: scheduledFor,
        payload: JSON.stringify({}),
      });
    })
  );
}
