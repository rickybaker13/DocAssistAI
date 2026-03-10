import { randomUUID } from 'crypto';
import { getPool } from '../database/db.js';

export interface SignupTrackingRecord {
  id: string;
  user_id: string;
  email: string;
  name: string | null;
  specialty: string | null;
  signup_source: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  referral_code: string | null;
  device_type: string | null;
  user_agent: string | null;
  ip_country: string | null;
  ip_region: string | null;
  subscription_status: string;
  billing_cycle: string | null;
  payment_method: string | null;
  trial_ends_at: string | null;
  converted_at: string | null;
  cancelled_at: string | null;
  non_conversion_reason: string | null;
  non_conversion_detail: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateSignupTrackingInput {
  userId: string;
  email: string;
  name?: string | null;
  specialty?: string | null;
  signupSource?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  referralCode?: string | null;
  deviceType?: string | null;
  userAgent?: string | null;
  ipCountry?: string | null;
  ipRegion?: string | null;
  trialEndsAt?: string | null;
}

export class ScribeSignupTrackingModel {
  async create(input: CreateSignupTrackingInput): Promise<SignupTrackingRecord> {
    const pool = getPool();
    const id = randomUUID();
    await pool.query(
      `INSERT INTO scribe_signup_tracking
       (id, user_id, email, name, specialty, signup_source, utm_source, utm_medium, utm_campaign,
        referral_code, device_type, user_agent, ip_country, ip_region, trial_ends_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
      [
        id,
        input.userId,
        input.email,
        input.name ?? null,
        input.specialty ?? null,
        input.signupSource ?? null,
        input.utmSource ?? null,
        input.utmMedium ?? null,
        input.utmCampaign ?? null,
        input.referralCode ?? null,
        input.deviceType ?? null,
        input.userAgent ?? null,
        input.ipCountry ?? null,
        input.ipRegion ?? null,
        input.trialEndsAt ?? null,
      ],
    );
    return (await this.findByUserId(input.userId))!;
  }

  async findByUserId(userId: string): Promise<SignupTrackingRecord | null> {
    const pool = getPool();
    const result = await pool.query(
      'SELECT * FROM scribe_signup_tracking WHERE user_id = $1',
      [userId],
    );
    return result.rows[0] ?? null;
  }

  async markConverted(userId: string, billingCycle: string, paymentMethod: string): Promise<void> {
    const pool = getPool();
    await pool.query(
      `UPDATE scribe_signup_tracking
       SET subscription_status = 'active',
           billing_cycle = $2,
           payment_method = $3,
           converted_at = NOW(),
           updated_at = NOW()
       WHERE user_id = $1`,
      [userId, billingCycle, paymentMethod],
    );
  }

  async markCancelled(userId: string): Promise<void> {
    const pool = getPool();
    await pool.query(
      `UPDATE scribe_signup_tracking
       SET subscription_status = 'cancelled',
           cancelled_at = NOW(),
           updated_at = NOW()
       WHERE user_id = $1`,
      [userId],
    );
  }

  async recordNonConversion(userId: string, reason: string, detail?: string | null): Promise<void> {
    const pool = getPool();
    await pool.query(
      `UPDATE scribe_signup_tracking
       SET non_conversion_reason = $2,
           non_conversion_detail = $3,
           updated_at = NOW()
       WHERE user_id = $1`,
      [userId, reason, detail ?? null],
    );
  }

  async syncStatusFromUser(userId: string): Promise<void> {
    const pool = getPool();
    await pool.query(
      `UPDATE scribe_signup_tracking st
       SET subscription_status = su.subscription_status,
           billing_cycle = su.billing_cycle,
           cancelled_at = su.cancelled_at,
           updated_at = NOW()
       FROM scribe_users su
       WHERE st.user_id = su.id AND st.user_id = $1`,
      [userId],
    );
  }

  async listAll(filters?: {
    status?: string;
    dateFrom?: string;
    dateTo?: string;
    search?: string;
  }): Promise<SignupTrackingRecord[]> {
    const pool = getPool();
    const conditions: string[] = [];
    const params: (string | null)[] = [];
    let idx = 1;

    if (filters?.status) {
      conditions.push(`st.subscription_status = $${idx++}`);
      params.push(filters.status);
    }
    if (filters?.dateFrom) {
      conditions.push(`st.created_at >= $${idx++}::timestamptz`);
      params.push(filters.dateFrom);
    }
    if (filters?.dateTo) {
      conditions.push(`st.created_at <= $${idx++}::timestamptz`);
      params.push(filters.dateTo);
    }
    if (filters?.search) {
      conditions.push(`(st.email ILIKE $${idx} OR st.name ILIKE $${idx})`);
      params.push(`%${filters.search}%`);
      idx++;
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Join with exit surveys to pull in non-conversion reasons
    const result = await pool.query(
      `SELECT st.*,
              es.reason AS exit_reason,
              es.suggestion AS exit_suggestion
       FROM scribe_signup_tracking st
       LEFT JOIN scribe_exit_surveys es ON es.user_id = st.user_id
       ${where}
       ORDER BY st.created_at DESC`,
      params,
    );

    return result.rows.map((row: any) => ({
      ...row,
      non_conversion_reason: row.non_conversion_reason || row.exit_reason || null,
      non_conversion_detail: row.non_conversion_detail || row.exit_suggestion || null,
    }));
  }

  async getStats(): Promise<{
    total: number;
    trialing: number;
    active: number;
    cancelled: number;
    expired: number;
    conversionRate: number;
  }> {
    const pool = getPool();
    const result = await pool.query(
      `SELECT
         COUNT(*) AS total,
         COUNT(*) FILTER (WHERE subscription_status = 'trialing') AS trialing,
         COUNT(*) FILTER (WHERE subscription_status = 'active') AS active,
         COUNT(*) FILTER (WHERE subscription_status = 'cancelled') AS cancelled,
         COUNT(*) FILTER (WHERE subscription_status = 'expired') AS expired,
         COUNT(*) FILTER (WHERE converted_at IS NOT NULL) AS converted
       FROM scribe_signup_tracking`,
    );
    const row = result.rows[0];
    const total = parseInt(row.total, 10) || 0;
    const converted = parseInt(row.converted, 10) || 0;
    return {
      total,
      trialing: parseInt(row.trialing, 10) || 0,
      active: parseInt(row.active, 10) || 0,
      cancelled: parseInt(row.cancelled, 10) || 0,
      expired: parseInt(row.expired, 10) || 0,
      conversionRate: total > 0 ? Math.round((converted / total) * 100) : 0,
    };
  }
}
