import { randomUUID } from 'crypto';
import { getPool } from '../database/db.js';

export type PaymentMethod = 'square_card' | 'bitcoin';

export interface ScribeBillingPreference {
  id: string;
  user_id: string;
  email: string;
  phone: string | null;
  payment_method: PaymentMethod;
  network: string | null;
  monthly_price_usd: number;
  discount_percent: number;
  effective_price_usd: number;
  trial_days: number;
  created_at: string;
}

interface CreateBillingPreferenceInput {
  userId: string;
  email: string;
  phone?: string;
  paymentMethod: PaymentMethod;
  network?: string;
}

export class ScribeBillingModel {
  async createPreference(input: CreateBillingPreferenceInput): Promise<ScribeBillingPreference> {
    const pool = getPool();
    const id = randomUUID();
    const monthlyPriceUsd = 20;
    const discountPercent = 0;
    const effectivePriceUsd = Number((monthlyPriceUsd * (1 - discountPercent / 100)).toFixed(2));
    const trialDays = 7;

    await pool.query(
      `INSERT INTO scribe_billing_preferences (
         id,
         user_id,
         email,
         phone,
         payment_method,
         network,
         monthly_price_usd,
         discount_percent,
         effective_price_usd,
         trial_days
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        id,
        input.userId,
        input.email,
        input.phone ?? null,
        input.paymentMethod,
        input.network ?? null,
        monthlyPriceUsd,
        discountPercent,
        effectivePriceUsd,
        trialDays,
      ],
    );

    const result = await pool.query('SELECT * FROM scribe_billing_preferences WHERE id = $1', [id]);
    return result.rows[0] as ScribeBillingPreference;
  }

  async listForUser(userId: string): Promise<ScribeBillingPreference[]> {
    const pool = getPool();
    const result = await pool.query(
      'SELECT * FROM scribe_billing_preferences WHERE user_id = $1 ORDER BY created_at DESC',
      [userId],
    );
    return result.rows as ScribeBillingPreference[];
  }
}
