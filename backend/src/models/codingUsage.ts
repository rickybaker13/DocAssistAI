import { getPool } from '../database/db.js';
import { randomUUID } from 'crypto';

export interface CodingUsage {
  id: string;
  team_id: string;
  month: string;
  notes_coded: number;
  overage_notes: number;
  overage_charge_cents: number;
}

/** Returns the first day of the current month as YYYY-MM-DD. */
function currentMonth(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  return `${yyyy}-${mm}-01`;
}

export class CodingUsageModel {
  /**
   * Increment notes_coded for the team's current month.
   * If notes_coded exceeds includedNotes, overflow goes into overage.
   * Uses SELECT + INSERT/UPDATE to avoid ON CONFLICT issues in pg-mem.
   */
  async increment(teamId: string, includedNotes: number): Promise<CodingUsage> {
    const pool = getPool();
    const month = currentMonth();

    // Check if a row already exists
    const existing = await pool.query(
      `SELECT * FROM coding_usage WHERE team_id = $1 AND month = $2`,
      [teamId, month],
    );

    if (existing.rows.length > 0) {
      const row = existing.rows[0];
      const newNotesCoded = (row.notes_coded ?? 0) + 1;
      const overageNotes = Math.max(0, newNotesCoded - includedNotes);
      // Simple overage: 10 cents per overage note (matches coding_teams.overage_rate_cents default)
      const overageChargeCents = overageNotes * 10;
      await pool.query(
        `UPDATE coding_usage SET notes_coded = $1, overage_notes = $2, overage_charge_cents = $3 WHERE id = $4`,
        [newNotesCoded, overageNotes, overageChargeCents, row.id],
      );
      return (await this.getForMonth(teamId, month))!;
    }

    // First note this month — insert
    const id = randomUUID();
    const notesCoded = 1;
    const overageNotes = notesCoded > includedNotes ? 1 : 0;
    const overageChargeCents = overageNotes * 10;
    await pool.query(
      `INSERT INTO coding_usage (id, team_id, month, notes_coded, overage_notes, overage_charge_cents) VALUES ($1,$2,$3,$4,$5,$6)`,
      [id, teamId, month, notesCoded, overageNotes, overageChargeCents],
    );
    return (await this.getForMonth(teamId, month))!;
  }

  async getForMonth(teamId: string, month?: string): Promise<CodingUsage | null> {
    const pool = getPool();
    const m = month ?? currentMonth();
    const result = await pool.query(
      `SELECT * FROM coding_usage WHERE team_id = $1 AND month = $2`,
      [teamId, m],
    );
    return result.rows[0] ?? null;
  }

  async getHistory(teamId: string, limit?: number): Promise<CodingUsage[]> {
    const pool = getPool();
    const result = await pool.query(
      `SELECT * FROM coding_usage WHERE team_id = $1 ORDER BY month DESC LIMIT $2`,
      [teamId, limit ?? 12],
    );
    return result.rows;
  }
}
