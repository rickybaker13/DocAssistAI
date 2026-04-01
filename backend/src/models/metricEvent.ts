import { randomUUID } from 'crypto';
import { getPool } from '../database/db.js';

export interface MetricEvent {
  id: string;
  team_id: string;
  user_id: string;
  event_type: string;
  note_id: string | null;
  metadata: Record<string, unknown>;
  event_date: string;
  created_at: string;
}

export interface MetricSummary {
  event_type: string;
  count: number;
}

export interface DailySummary {
  event_date: string;
  event_type: string;
  count: number;
}

export interface ProviderSummary {
  user_id: string;
  name: string | null;
  email: string;
  event_type: string;
  count: number;
}

// Well-known event types that can be auto-captured from note activity
export const EVENT_TYPES = {
  PATIENT_ENCOUNTER: 'patient_encounter',
  ADMISSION: 'admission',
  DISCHARGE: 'discharge',
  TRANSFER: 'transfer',
  PROCEDURE: 'procedure',
  CONSULT: 'consult',
  CODE_RESPONSE: 'code_response',
  FAMILY_MEETING: 'family_meeting',
  NOTE_COMPLETED: 'note_completed',
  CUSTOM: 'custom',
} as const;

export class MetricEventModel {
  // ---------------------------------------------------------------------------
  // Log events
  // ---------------------------------------------------------------------------

  async log(input: {
    teamId: string;
    userId: string;
    eventType: string;
    noteId?: string;
    metadata?: Record<string, unknown>;
    eventDate?: string; // ISO date string (YYYY-MM-DD), defaults to today
  }): Promise<MetricEvent> {
    const pool = getPool();
    const id = randomUUID();
    await pool.query(
      `INSERT INTO metric_events (id, team_id, user_id, event_type, note_id, metadata, event_date)
       VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7::date, CURRENT_DATE))`,
      [
        id,
        input.teamId,
        input.userId,
        input.eventType,
        input.noteId ?? null,
        JSON.stringify(input.metadata ?? {}),
        input.eventDate ?? null,
      ],
    );
    const result = await pool.query('SELECT * FROM metric_events WHERE id = $1', [id]);
    return result.rows[0];
  }

  async logBatch(events: Array<{
    teamId: string;
    userId: string;
    eventType: string;
    noteId?: string;
    metadata?: Record<string, unknown>;
    eventDate?: string;
  }>): Promise<number> {
    if (events.length === 0) return 0;
    const pool = getPool();

    const valueClauses: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    for (const e of events) {
      valueClauses.push(
        `($${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, COALESCE($${paramIndex++}::date, CURRENT_DATE))`,
      );
      values.push(
        randomUUID(),
        e.teamId,
        e.userId,
        e.eventType,
        e.noteId ?? null,
        JSON.stringify(e.metadata ?? {}),
        e.eventDate ?? null,
      );
    }

    await pool.query(
      `INSERT INTO metric_events (id, team_id, user_id, event_type, note_id, metadata, event_date)
       VALUES ${valueClauses.join(', ')}`,
      values,
    );
    return events.length;
  }

  // ---------------------------------------------------------------------------
  // Queries — aggregate metrics
  // ---------------------------------------------------------------------------

  async summary(teamId: string, options: {
    from?: string;
    to?: string;
    userId?: string;
  } = {}): Promise<MetricSummary[]> {
    const pool = getPool();
    const conditions = ['team_id = $1'];
    const values: any[] = [teamId];
    let paramIndex = 2;

    if (options.from) {
      conditions.push(`event_date >= $${paramIndex++}`);
      values.push(options.from);
    }
    if (options.to) {
      conditions.push(`event_date <= $${paramIndex++}`);
      values.push(options.to);
    }
    if (options.userId) {
      conditions.push(`user_id = $${paramIndex++}`);
      values.push(options.userId);
    }

    const result = await pool.query(
      `SELECT event_type, COUNT(*)::int AS count
       FROM metric_events
       WHERE ${conditions.join(' AND ')}
       GROUP BY event_type
       ORDER BY count DESC`,
      values,
    );
    return result.rows;
  }

  async dailyBreakdown(teamId: string, options: {
    from?: string;
    to?: string;
    userId?: string;
    eventType?: string;
  } = {}): Promise<DailySummary[]> {
    const pool = getPool();
    const conditions = ['team_id = $1'];
    const values: any[] = [teamId];
    let paramIndex = 2;

    if (options.from) {
      conditions.push(`event_date >= $${paramIndex++}`);
      values.push(options.from);
    }
    if (options.to) {
      conditions.push(`event_date <= $${paramIndex++}`);
      values.push(options.to);
    }
    if (options.userId) {
      conditions.push(`user_id = $${paramIndex++}`);
      values.push(options.userId);
    }
    if (options.eventType) {
      conditions.push(`event_type = $${paramIndex++}`);
      values.push(options.eventType);
    }

    const result = await pool.query(
      `SELECT event_date, event_type, COUNT(*)::int AS count
       FROM metric_events
       WHERE ${conditions.join(' AND ')}
       GROUP BY event_date, event_type
       ORDER BY event_date DESC, count DESC`,
      values,
    );
    return result.rows;
  }

  async providerBreakdown(teamId: string, options: {
    from?: string;
    to?: string;
    eventType?: string;
  } = {}): Promise<ProviderSummary[]> {
    const pool = getPool();
    const conditions = ['me.team_id = $1'];
    const values: any[] = [teamId];
    let paramIndex = 2;

    if (options.from) {
      conditions.push(`me.event_date >= $${paramIndex++}`);
      values.push(options.from);
    }
    if (options.to) {
      conditions.push(`me.event_date <= $${paramIndex++}`);
      values.push(options.to);
    }
    if (options.eventType) {
      conditions.push(`me.event_type = $${paramIndex++}`);
      values.push(options.eventType);
    }

    const result = await pool.query(
      `SELECT me.user_id, su.name, su.email, me.event_type, COUNT(*)::int AS count
       FROM metric_events me
       JOIN scribe_users su ON su.id = me.user_id
       WHERE ${conditions.join(' AND ')}
       GROUP BY me.user_id, su.name, su.email, me.event_type
       ORDER BY count DESC`,
      values,
    );
    return result.rows;
  }

  async listEvents(teamId: string, options: {
    from?: string;
    to?: string;
    userId?: string;
    eventType?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<{ events: MetricEvent[]; total: number }> {
    const pool = getPool();
    const conditions = ['team_id = $1'];
    const values: any[] = [teamId];
    let paramIndex = 2;

    if (options.from) {
      conditions.push(`event_date >= $${paramIndex++}`);
      values.push(options.from);
    }
    if (options.to) {
      conditions.push(`event_date <= $${paramIndex++}`);
      values.push(options.to);
    }
    if (options.userId) {
      conditions.push(`user_id = $${paramIndex++}`);
      values.push(options.userId);
    }
    if (options.eventType) {
      conditions.push(`event_type = $${paramIndex++}`);
      values.push(options.eventType);
    }

    const whereClause = conditions.join(' AND ');

    const countResult = await pool.query(
      `SELECT COUNT(*)::int AS total FROM metric_events WHERE ${whereClause}`,
      values,
    );

    const limit = Math.min(options.limit ?? 100, 500);
    const offset = options.offset ?? 0;
    values.push(limit, offset);

    const result = await pool.query(
      `SELECT * FROM metric_events
       WHERE ${whereClause}
       ORDER BY event_date DESC, created_at DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      values,
    );

    return { events: result.rows, total: countResult.rows[0].total };
  }
}
