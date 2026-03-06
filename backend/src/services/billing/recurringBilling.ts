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
    `SELECT id, email, square_customer_id, square_card_id, period_ends_at
     FROM scribe_users
     WHERE subscription_status = 'active'
       AND period_ends_at <= NOW() + INTERVAL '1 day'
       AND square_card_id IS NOT NULL
       AND square_customer_id IS NOT NULL
       AND cancelled_at IS NULL`,
  );

  for (const user of rows) {
    try {
      const { paymentId } = await chargeStoredCard(
        { accessToken: squareConfig.accessToken, environment: squareConfig.environment },
        {
          customerId: user.square_customer_id,
          cardId: user.square_card_id,
          amountCents: 2000,
          currency: 'USD',
          locationId: squareConfig.locationId,
          idempotencyKey: randomUUID(),
          note: `DocAssistAI subscription renewal for ${user.email}`,
        },
      );

      // Extend period by 30 days
      await userModel.activateSubscription(user.id);

      // Log successful payment
      await paymentHistoryModel.create({
        userId: user.id,
        squarePaymentId: paymentId,
        amountCents: 2000,
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
        amountCents: 2000,
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

export async function sendTrialExpiringReminders(): Promise<number> {
  const pool = getPool();

  // Find trialing users whose trial ends in ~3 days (between 2.5 and 3.5 days from now)
  const { rows } = await pool.query(
    `SELECT id, email
     FROM scribe_users
     WHERE subscription_status = 'trialing'
       AND trial_ends_at > NOW() + INTERVAL '2.5 days'
       AND trial_ends_at <= NOW() + INTERVAL '3.5 days'
       AND square_card_id IS NULL`,
  );

  for (const user of rows) {
    await emailService.sendTrialExpiringEmail(user.email, 3);
  }

  return rows.length;
}
