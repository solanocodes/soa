import { query } from '../config/database';

const PRODUCT_CONFIGS: Record<string, { price_id: string; tier: string; name: string }> = {
  'soa_core_monthly': {
    price_id: process.env.STRIPE_PRICE_SOA_CORE_MONTHLY || 'price_soa_core_monthly',
    tier: 'SOA_CORE',
    name: 'SOA Core Monthly',
  },
  'soa_core_yearly': {
    price_id: process.env.STRIPE_PRICE_SOA_CORE_YEARLY || 'price_soa_core_yearly',
    tier: 'SOA_CORE',
    name: 'SOA Core Yearly',
  },
  'soa_wealth_monthly': {
    price_id: process.env.STRIPE_PRICE_SOA_WEALTH_MONTHLY || 'price_soa_wealth_monthly',
    tier: 'SOA_WEALTH',
    name: 'SOA Wealth Monthly',
  },
  'soa_wealth_yearly': {
    price_id: process.env.STRIPE_PRICE_SOA_WEALTH_YEARLY || 'price_soa_wealth_yearly',
    tier: 'SOA_WEALTH',
    name: 'SOA Wealth Yearly',
  },
  'bot_product_monthly': {
    price_id: process.env.STRIPE_PRICE_BOT_MONTHLY || 'price_bot_monthly',
    tier: 'BOT_PRODUCT',
    name: 'Bot Product Monthly',
  },
  'bot_product_yearly': {
    price_id: process.env.STRIPE_PRICE_BOT_YEARLY || 'price_bot_yearly',
    tier: 'BOT_PRODUCT',
    name: 'Bot Product Yearly',
  },
};

export async function createCheckoutSession(
  userId: string,
  productType: string,
  successUrl?: string,
  cancelUrl?: string
): Promise<{ url: string; id: string }> {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('Stripe not configured');
  }

  const Stripe = require('stripe');
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

  const productConfig = PRODUCT_CONFIGS[productType];
  if (!productConfig) {
    throw new Error(`Invalid product type: ${productType}`);
  }

  // Get or create Stripe customer
  const userResult = await query(
    'SELECT email, stripe_customer_id FROM users WHERE id = $1',
    [userId]
  );

  if (userResult.rows.length === 0) {
    throw new Error('User not found');
  }

  const user = userResult.rows[0];
  let customerId = user.stripe_customer_id;

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      metadata: { user_id: userId },
    });
    customerId = customer.id;
    await query('UPDATE users SET stripe_customer_id = $1 WHERE id = $2', [customerId, userId]);
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    payment_method_types: ['card'],
    mode: 'subscription',
    line_items: [
      {
        price: productConfig.price_id,
        quantity: 1,
      },
    ],
    success_url: successUrl || 'https://app.simplyoptionsacademy.com/payment/success?session_id={CHECKOUT_SESSION_ID}',
    cancel_url: cancelUrl || 'https://app.simplyoptionsacademy.com/payment/cancel',
    metadata: {
      user_id: userId,
      product_type: productType,
      tier: productConfig.tier,
    },
    subscription_data: {
      metadata: {
        user_id: userId,
        product_type: productType,
        tier: productConfig.tier,
      },
    },
  });

  return { url: session.url, id: session.id };
}

export async function handleWebhook(req: any): Promise<void> {
  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
    throw new Error('Stripe not configured');
  }

  const Stripe = require('stripe');
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

  const sig = req.headers['stripe-signature'];
  let event: any;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err: any) {
    throw new Error(`Webhook signature verification failed: ${err.message}`);
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      const userId = session.metadata?.user_id;
      const tier = session.metadata?.tier;
      const productType = session.metadata?.product_type;

      if (userId && tier) {
        // Update user tier
        await query(
          `UPDATE users SET
             tier = $1,
             subscription_id = $2,
             subscription_status = 'active',
             subscription_expires_at = NOW() + INTERVAL '30 days',
             updated_at = NOW()
           WHERE id = $3`,
          [tier, session.subscription, userId]
        );

        // Record payment
        await query(
          `INSERT INTO payments (user_id, stripe_payment_id, amount, product_type, status, metadata)
           VALUES ($1, $2, $3, $4, 'succeeded', $5)`,
          [userId, session.payment_intent, (session.amount_total || 0) / 100, productType || tier, JSON.stringify(session.metadata)]
        );

        // Convert referral if exists
        await query(
          `UPDATE referrals SET status = 'converted', reward_amount = 10.00, rewarded_at = NOW()
           WHERE referred_id = $1 AND status = 'pending'`,
          [userId]
        );

        // Send notification
        const { sendPushNotification } = require('./notifications');
        await sendPushNotification(
          userId,
          'Welcome to the team! 🎉',
          `Your ${tier.replace('_', ' ')} subscription is now active!`,
          { type: 'tier_upgraded', new_tier: tier }
        );
      }
      break;
    }

    case 'customer.subscription.updated': {
      const subscription = event.data.object;
      const userId = subscription.metadata?.user_id;

      if (userId) {
        const status = subscription.status;
        await query(
          `UPDATE users SET
             subscription_status = $1,
             subscription_expires_at = to_timestamp($2),
             updated_at = NOW()
           WHERE id = $3`,
          [status, subscription.current_period_end, userId]
        );

        // If subscription went past_due or canceled, potentially downgrade
        if (status === 'canceled' || status === 'unpaid') {
          await query(
            "UPDATE users SET tier = 'FREE', subscription_id = NULL WHERE id = $1",
            [userId]
          );
        }
      }
      break;
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object;
      const userId = subscription.metadata?.user_id;

      if (userId) {
        await query(
          `UPDATE users SET
             tier = 'FREE',
             subscription_status = 'canceled',
             subscription_id = NULL,
             updated_at = NOW()
           WHERE id = $1`,
          [userId]
        );
      }
      break;
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object;
      const customerId = invoice.customer;

      const user = await query(
        'SELECT id FROM users WHERE stripe_customer_id = $1',
        [customerId]
      );

      if (user.rows.length > 0) {
        await query(
          "UPDATE users SET subscription_status = 'past_due' WHERE id = $1",
          [user.rows[0].id]
        );

        // Record failed payment
        await query(
          `INSERT INTO payments (user_id, stripe_payment_id, amount, product_type, status)
           VALUES ($1, $2, $3, 'subscription', 'failed')`,
          [user.rows[0].id, invoice.payment_intent, (invoice.amount_due || 0) / 100]
        );
      }
      break;
    }

    default:
      console.log(`Unhandled Stripe event type: ${event.type}`);
  }
}
