import { Router, Request, Response } from 'express';
import express from 'express';
import { query } from '../config/database';
import { authenticate, AuthRequest } from '../middleware/auth';
import { paginationParams } from '../utils/helpers';

const router = Router();

// POST /create-checkout - create Stripe Checkout session
router.post('/create-checkout', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { product_type, success_url, cancel_url } = req.body;

    if (!product_type) {
      res.status(400).json({ error: 'product_type is required' });
      return;
    }

    const { createCheckoutSession } = require('../services/stripe');
    const session = await createCheckoutSession(req.user!.id, product_type, success_url, cancel_url);

    res.json({ checkout_url: session.url, session_id: session.id });
  } catch (error: any) {
    console.error('Create checkout error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// POST /webhook - Stripe webhook handler (uses raw body)
router.post('/webhook', express.raw({ type: 'application/json' }), async (req: Request, res: Response) => {
  try {
    const { handleWebhook } = require('../services/stripe');
    await handleWebhook(req);
    res.json({ received: true });
  } catch (error: any) {
    console.error('Webhook error:', error);
    res.status(400).json({ error: error.message });
  }
});

// GET /history - user's payment history
router.get('/history', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { offset, limit, page } = paginationParams(req.query as any);

    const payments = await query(
      `SELECT id, stripe_payment_id, amount, currency, product_type, status, metadata, created_at
       FROM payments
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [req.user!.id, limit, offset]
    );

    const countResult = await query(
      'SELECT COUNT(*) as total FROM payments WHERE user_id = $1',
      [req.user!.id]
    );
    const total = parseInt(countResult.rows[0].total);

    res.json({
      payments: payments.rows,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) }
    });
  } catch (error: any) {
    console.error('Get payment history error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
