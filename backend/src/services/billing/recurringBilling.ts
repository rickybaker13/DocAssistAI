import { randomUUID } from 'crypto';
import { getPool } from '../../database/db.js';
import { ScribeUserModel } from '../../models/scribeUser.js';
import { ScribePaymentHistoryModel } from '../../models/scribePaymentHistory.js';
import { chargeStoredCard } from './squareCustomer.js';
import { emailService } from '../email/emailService.js';

const userModel = new ScribeUserModel();
const paymentHistoryModel = new ScribePaymentHistoryModel();

interface RenewalResult {
  userId: string;
  email: string;
  success: boolean;
  error?: string;
}

export async function processAutoRenewals(squareConfig: {
  accessToken: string;
  locationId: string;
  environment: 'sandbox' | 'production';
}): Promise<RenewalResult[]> {
  const pool = getPool();
  const results: RenewalResult[] = [];

  // Find active users whose period ends within the next 24 hours
  // and who have a card on file and haven't cancelled
  const { rows } = await pool.query(
    `SELECT id, email, square_customer_id, square_card_id, period_ends_at, billing_cycle
     FROM scribe_users
     WHERE subscription_status = 'active'
       AND period_ends_at <= NOW() + INTERVAL '1 day'
       AND square_card_id IS NOT NULL
       AND square_customer_id IS NOT NULL
       AND cancelled_at IS NULL`,
  );

  for (const user of rows) {
    const cycle = user.billing_cycle === 'annual' ? 'annual' : 'monthly' as const;
    const amountCents = cycle === 'annual' ? 20000 : 2000;

    try {
      const { paymentId } = await chargeStoredCard(
        { accessToken: squareConfig.accessToken, environment: squareConfig.environment },
        {
          customerId: user.square_customer_id,
          cardId: user.square_card_id,
          amountCents,
          currency: 'USD',
          locationId: squareConfig.locationId,
          idempotencyKey: randomUUID(),
          note: `DocAssistAI ${cycle} subscription renewal for ${user.email}`,
        },
      );

      // Extend period by 30 days (monthly) or 365 days (annual)
      await userModel.activateSubscription(user.id, cycle);

      // Log successful payment
      await paymentHistoryModel.create({
        userId: user.id,
        squarePaymentId: paymentId,
        amountCents,
        status: 'completed',
      });

      results.push({ userId: user.id, email: user.email, success: true });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';

      // Mark as expired
      await userModel.markExpired(user.id);

      // Log failed payment
      await paymentHistoryModel.create({
        userId: user.id,
        amountCents,
        status: 'failed',
        failureReason: errorMsg,
      });

      // Email user about payment failure
      await emailService.sendPaymentFailedEmail(user.email);

      results.push({ userId: user.id, email: user.email, success: false, error: errorMsg });
    }
  }

  return results;
}

/**
 * 3-stage trial reminder system.
 * Stage 1 (welcome) is sent at registration (fire-and-forget).
 * Stage 2 (midpoint) is sent ~3-4 days into the trial.
 * Stage 3 (urgent) is sent ~6 days into the trial (1 day before expiry).
 *
 * Each stage atomically updates trial_reminder_stage to prevent duplicates.
 */
export async function sendTrialExpiringReminders(): Promise<{ stage2: number; stage3: number }> {
  const pool = getPool();
  let stage2Sent = 0;
  let stage3Sent = 0;

  // --- Stage 2: Midpoint reminder (trial ends in 2.5–3.5 days) ---
  const { rows: midpointUsers } = await pool.query(
    `SELECT id, email, trial_ends_at
     FROM scribe_users
     WHERE subscription_status = 'trialing'
       AND trial_reminder_stage < 2
       AND trial_ends_at > NOW() + INTERVAL '2.5 days'
       AND trial_ends_at <= NOW() + INTERVAL '3.5 days'`,
  );

  for (const user of midpointUsers) {
    try {
      await emailService.sendTrialMidpointEmail(user.email, user.trial_ends_at);
      await pool.query(
        'UPDATE scribe_users SET trial_reminder_stage = 2 WHERE id = $1 AND trial_reminder_stage < 2',
        [user.id],
      );
      stage2Sent++;
    } catch (err) {
      console.error(`[trial-reminder] Stage 2 failed for ${user.email}:`, err);
    }
  }

  // --- Stage 3: Urgent reminder (trial ends in 0.5–1.5 days) ---
  const { rows: urgentUsers } = await pool.query(
    `SELECT id, email, trial_ends_at
     FROM scribe_users
     WHERE subscription_status = 'trialing'
       AND trial_reminder_stage < 3
       AND trial_ends_at > NOW() + INTERVAL '0.5 days'
       AND trial_ends_at <= NOW() + INTERVAL '1.5 days'`,
  );

  for (const user of urgentUsers) {
    try {
      await emailService.sendTrialUrgentEmail(user.email, user.trial_ends_at);
      await pool.query(
        'UPDATE scribe_users SET trial_reminder_stage = 3 WHERE id = $1 AND trial_reminder_stage < 3',
        [user.id],
      );
      stage3Sent++;
    } catch (err) {
      console.error(`[trial-reminder] Stage 3 failed for ${user.email}:`, err);
    }
  }

  return { stage2: stage2Sent, stage3: stage3Sent };
}

/**
 * Proactively expire ended trials and send notification emails.
 * This is a safety net — scribeSubscriptionMiddleware also marks users expired on-the-fly.
 */
export async function expireEndedTrials(): Promise<number> {
  const pool = getPool();

  const { rows } = await pool.query(
    `SELECT id, email
     FROM scribe_users
     WHERE subscription_status = 'trialing'
       AND trial_ends_at < NOW()
       AND is_admin = FALSE`,
  );

  for (const user of rows) {
    try {
      await userModel.markExpired(user.id);
      await emailService.sendSubscriptionExpiredEmail(user.email);
    } catch (err) {
      console.error(`[expire-trials] Failed for ${user.email}:`, err);
    }
  }

  return rows.length;
}
