import { getPool } from '../../database/db.js';

/**
 * Data retention cleanup — runs via cron.
 *
 * Policy:
 *   - Notes older than 3 days (from last edit)     → deleted
 *   - Expired trial accounts (30 days past expiry) → purged (CASCADE deletes all related data)
 *   - Cancelled accounts (90 days past period end)  → purged
 *   - Stale password reset tokens/OTPs (24 hours)   → swept
 *   - Audit logs                                    → handled by Winston file rotation (1 year)
 */

export interface RetentionResult {
  notesDeleted: number;
  expiredTrialsPurged: number;
  cancelledAccountsPurged: number;
  staleTokensSwept: number;
  staleOtpsSwept: number;
}

export async function runDataRetention(): Promise<RetentionResult> {
  const pool = getPool();

  // 1. Delete notes older than 3 days (by updated_at — last edit)
  const notesResult = await pool.query(
    `DELETE FROM scribe_notes WHERE updated_at < NOW() - INTERVAL '3 days'`,
  );

  // 2. Purge expired trial accounts — 30 days past trial_ends_at, never converted
  //    ON DELETE CASCADE handles notes, templates, billing prefs, feedback, etc.
  const trialsResult = await pool.query(
    `DELETE FROM scribe_users
     WHERE subscription_status IN ('trialing', 'expired')
       AND trial_ends_at < NOW() - INTERVAL '30 days'
       AND subscription_status != 'active'
       AND id NOT IN (SELECT user_id FROM scribe_payment_history)`,
  );

  // 3. Purge cancelled accounts — 90 days past period_ends_at
  const cancelledResult = await pool.query(
    `DELETE FROM scribe_users
     WHERE subscription_status = 'cancelled'
       AND period_ends_at < NOW() - INTERVAL '90 days'`,
  );

  // 4. Sweep stale password reset tokens (expired > 24 hours ago)
  const tokensResult = await pool.query(
    `DELETE FROM scribe_password_reset_tokens
     WHERE expires_at < NOW() - INTERVAL '24 hours'`,
  );

  // 5. Sweep stale password reset OTPs (expired > 24 hours ago)
  const otpsResult = await pool.query(
    `DELETE FROM scribe_password_reset_otps
     WHERE expires_at < NOW() - INTERVAL '24 hours'`,
  );

  return {
    notesDeleted: notesResult.rowCount ?? 0,
    expiredTrialsPurged: trialsResult.rowCount ?? 0,
    cancelledAccountsPurged: cancelledResult.rowCount ?? 0,
    staleTokensSwept: tokensResult.rowCount ?? 0,
    staleOtpsSwept: otpsResult.rowCount ?? 0,
  };
}
