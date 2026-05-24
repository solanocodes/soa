import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import db from '@/lib/database';
import { generateAccessToken, generateRefreshToken } from '@/lib/jwt';
import { errorResponse } from '@/lib/api-helpers';

function generateReferralCode(): string {
  return crypto.randomBytes(4).toString('hex');
}

export async function POST(req: NextRequest) {
  try {
    const { email, username, display_name, password } = await req.json();

    if (!email || !username || !password) {
      return errorResponse('Email, username, and password are required', 400);
    }

    if (password.length < 8) {
      return errorResponse('Password must be at least 8 characters', 400);
    }

    // Check existing email
    const existingUser = await db('users').where({ email }).first();
    if (existingUser) {
      return errorResponse('Email already registered', 409);
    }

    // Check existing username
    const existingUsername = await db('users').where({ username }).first();
    if (existingUsername) {
      return errorResponse('Username already taken', 409);
    }

    const password_hash = await bcrypt.hash(password, 12);
    const referral_code = generateReferralCode();

    const [user] = await db('users')
      .insert({
        email,
        username,
        display_name: display_name || null,
        password_hash,
        referral_code,
        tier: 'FREE',
        is_admin: false,
        is_coach: false,
        onboarding_day: 0,
        onboarding_completed: false,
      })
      .returning('*');

    const { password_hash: _, ...userWithoutPassword } = user;

    // Schedule onboarding automation events
    const now = new Date();
    const onboardingEvents = [
      { day: 0, type: 'onboarding_welcome' },
      { day: 1, type: 'onboarding_module1' },
      { day: 2, type: 'onboarding_checkin' },
      { day: 6, type: 'onboarding_week1' },
      { day: 11, type: 'onboarding_cohort' },
      { day: 29, type: 'onboarding_month1' },
    ];

    Promise.all(
      onboardingEvents.map(({ day, type }) => {
        const scheduledFor = new Date(now);
        scheduledFor.setDate(scheduledFor.getDate() + day);
        scheduledFor.setHours(9, 0, 0, 0);

        return db('automation_events').insert({
          user_id: user.id,
          event_type: type,
          scheduled_for: scheduledFor,
          payload: JSON.stringify({}),
        });
      })
    ).catch((err) => {
      console.error('Failed to schedule onboarding:', err);
    });

    const tokenPayload = {
      userId: user.id,
      tier: user.tier,
      isAdmin: user.is_admin,
      isCoach: user.is_coach,
    };

    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    return NextResponse.json(
      { user: userWithoutPassword, accessToken, refreshToken },
      { status: 201 }
    );
  } catch (err: any) {
    console.error('Register error:', err);
    return errorResponse(err.message || 'Internal server error', 500);
  }
}
