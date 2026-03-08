import { randomUUID, createHash } from 'crypto';
import { getPool } from '../database/db.js';

export interface ScribeUser {
  id: string;
  email: string;
  password_hash: string;
  name: string | null;
  specialty: string | null;
  subscription_status: 'trialing' | 'active' | 'cancelled' | 'expired';
  trial_ends_at: string | null;
  period_ends_at: string | null;
  cancelled_at: string | null;
  square_customer_id: string | null;
  square_card_id: string | null;
  is_admin: boolean;
  billing_cycle: 'monthly' | 'annual';
  billing_codes_enabled: boolean;
  tos_accepted_at: string | null;
  privacy_accepted_at: string | null;
  tos_version: string | null;
  created_at: string;
  updated_at: string;
}

export class ScribeUserModel {
  private hashValue(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }

  async create(input: { email: string; passwordHash: string; name?: string; specialty?: string }): Promise<ScribeUser> {
    const pool = getPool();
    const id = randomUUID();
    await pool.query(
      `INSERT INTO scribe_users (id, email, password_hash, name, specialty, subscription_status, trial_ends_at)
       VALUES ($1, $2, $3, $4, $5, 'trialing', NOW() + INTERVAL '7 days')`,
      [id, input.email, input.passwordHash, input.name ?? null, input.specialty ?? null]
    );
    return (await this.findById(id))!;
  }

  async findByEmail(email: string): Promise<ScribeUser | null> {
    const pool = getPool();
    const result = await pool.query('SELECT * FROM scribe_users WHERE email = $1', [email]);
    return result.rows[0] ?? null;
  }

  async findById(id: string): Promise<ScribeUser | null> {
    const pool = getPool();
    const result = await pool.query('SELECT * FROM scribe_users WHERE id = $1', [id]);
    return result.rows[0] ?? null;
  }

  async update(id: string, fields: { name?: string | null; specialty?: string | null; billing_codes_enabled?: boolean }): Promise<ScribeUser | null> {
    const pool = getPool();
    await pool.query(
      `UPDATE scribe_users
       SET name = COALESCE($1, name),
           specialty = COALESCE($2, specialty),
           billing_codes_enabled = COALESCE($3, billing_codes_enabled),
           updated_at = NOW()
       WHERE id = $4`,
      [fields.name ?? null, fields.specialty ?? null, fields.billing_codes_enabled ?? null, id]
    );
    return this.findById(id);
  }

  async createPasswordResetToken(userId: string): Promise<string> {
    const pool = getPool();
    const rawToken = randomUUID().replace(/-/g, '') + randomUUID().replace(/-/g, '');
    const tokenHash = this.hashValue(rawToken);
    await pool.query('DELETE FROM scribe_password_reset_tokens WHERE user_id = $1', [userId]);
    await pool.query(
      `INSERT INTO scribe_password_reset_tokens (id, user_id, token_hash, expires_at)
       VALUES ($1, $2, $3, NOW() + INTERVAL '30 minutes')`,
      [randomUUID(), userId, tokenHash]
    );
    return rawToken;
  }

  async consumePasswordResetToken(token: string): Promise<string | null> {
    const pool = getPool();
    const tokenHash = this.hashValue(token);
    const result = await pool.query(
      `SELECT id, user_id
       FROM scribe_password_reset_tokens
       WHERE token_hash = $1 AND used_at IS NULL AND expires_at > NOW()
       LIMIT 1`,
      [tokenHash]
    );
    const row = result.rows[0];
    if (!row) return null;
    await pool.query('UPDATE scribe_password_reset_tokens SET used_at = NOW() WHERE id = $1', [row.id]);
    return row.user_id as string;
  }

  async createPasswordResetOtp(userId: string): Promise<string> {
    const pool = getPool();
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const otpHash = this.hashValue(otp);
    await pool.query('DELETE FROM scribe_password_reset_otps WHERE user_id = $1', [userId]);
    await pool.query(
      `INSERT INTO scribe_password_reset_otps (id, user_id, otp_hash, expires_at)
       VALUES ($1, $2, $3, NOW() + INTERVAL '15 minutes')`,
      [randomUUID(), userId, otpHash],
    );
    return otp;
  }

  async consumePasswordResetOtp(userId: string, otp: string): Promise<boolean> {
    const pool = getPool();
    const otpHash = this.hashValue(otp);
    const result = await pool.query(
      `SELECT id
       FROM scribe_password_reset_otps
       WHERE user_id = $1 AND otp_hash = $2 AND used_at IS NULL AND expires_at > NOW()
       ORDER BY created_at DESC
       LIMIT 1`,
      [userId, otpHash],
    );
    const row = result.rows[0];
    if (!row) return false;
    await pool.query('UPDATE scribe_password_reset_otps SET used_at = NOW() WHERE id = $1', [row.id]);
    return true;
  }

  async updatePassword(userId: string, passwordHash: string): Promise<void> {
    const pool = getPool();
    await pool.query('UPDATE scribe_users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [passwordHash, userId]);
  }

  async activateSubscription(userId: string, billingCycle: 'monthly' | 'annual' = 'monthly'): Promise<ScribeUser | null> {
    const pool = getPool();
    const interval = billingCycle === 'annual' ? '365 days' : '30 days';
    await pool.query(
      `UPDATE scribe_users
       SET subscription_status = 'active',
           billing_cycle = $2,
           period_ends_at = NOW() + INTERVAL '${interval}',
           cancelled_at = NULL,
           updated_at = NOW()
       WHERE id = $1`,
      [userId, billingCycle],
    );
    return this.findById(userId);
  }

  async cancelSubscription(userId: string): Promise<{ success: boolean; error?: string; user?: ScribeUser }> {
    const pool = getPool();
    const user = await this.findById(userId);
    if (!user) return { success: false, error: 'User not found' };

    if (user.subscription_status === 'cancelled') {
      return { success: false, error: 'Subscription is already cancelled.' };
    }

    // Determine period_ends_at:
    // - If they have a current period_ends_at, keep it (they paid, use that date)
    // - If they have billing history, use latest payment + 30 days
    // - Otherwise fall back to trial_ends_at
    let periodEndsAt = user.period_ends_at;

    if (!periodEndsAt) {
      const billingResult = await pool.query(
        `SELECT created_at FROM scribe_billing_preferences
         WHERE user_id = $1
         ORDER BY created_at DESC LIMIT 1`,
        [userId],
      );

      if (billingResult.rows[0]) {
        // Last payment + 30 days
        const lastPayment = new Date(billingResult.rows[0].created_at);
        lastPayment.setDate(lastPayment.getDate() + 30);
        periodEndsAt = lastPayment.toISOString();
      } else {
        // No payment ever made — fall back to trial end
        periodEndsAt = user.trial_ends_at;
      }
    }

    await pool.query(
      `UPDATE scribe_users
       SET subscription_status = 'cancelled',
           cancelled_at = NOW(),
           period_ends_at = COALESCE($1::timestamptz, period_ends_at, trial_ends_at),
           updated_at = NOW()
       WHERE id = $2`,
      [periodEndsAt, userId],
    );

    const updated = await this.findById(userId);
    return { success: true, user: updated ?? undefined };
  }

  async getSubscriptionStatus(userId: string): Promise<{
    subscription_status: string;
    trial_ends_at: string | null;
    period_ends_at: string | null;
    cancelled_at: string | null;
  } | null> {
    const user = await this.findById(userId);
    if (!user) return null;
    return {
      subscription_status: user.subscription_status,
      trial_ends_at: user.trial_ends_at,
      period_ends_at: user.period_ends_at,
      cancelled_at: user.cancelled_at,
    };
  }

  async markExpired(userId: string): Promise<void> {
    const pool = getPool();
    await pool.query(
      `UPDATE scribe_users SET subscription_status = 'expired', updated_at = NOW() WHERE id = $1`,
      [userId],
    );
  }

  async acceptTerms(userId: string, tosVersion: string): Promise<void> {
    const pool = getPool();
    await pool.query(
      `UPDATE scribe_users
       SET tos_accepted_at = NOW(),
           privacy_accepted_at = NOW(),
           tos_version = $1,
           updated_at = NOW()
       WHERE id = $2`,
      [tosVersion, userId],
    );
  }

  async getConsentStatus(userId: string): Promise<{
    tosAccepted: boolean;
    tosVersion: string | null;
    tosAcceptedAt: string | null;
  } | null> {
    const user = await this.findById(userId);
    if (!user) return null;
    return {
      tosAccepted: user.tos_accepted_at !== null,
      tosVersion: user.tos_version,
      tosAcceptedAt: user.tos_accepted_at,
    };
  }

  async updateSquareIds(userId: string, squareCustomerId: string, squareCardId: string): Promise<void> {
    const pool = getPool();
    await pool.query(
      `UPDATE scribe_users
       SET square_customer_id = $1, square_card_id = $2, updated_at = NOW()
       WHERE id = $3`,
      [squareCustomerId, squareCardId, userId],
    );
  }
}
