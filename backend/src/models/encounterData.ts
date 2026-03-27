import { randomUUID } from 'crypto';
import { getPool } from '../database/db.js';

export interface EncounterData {
  id: string;
  team_id: string;
  user_id: string;
  note_id: string | null;
  primary_diagnosis: string | null;
  diagnosis_codes: string[];
  acuity_scores: Record<string, number>;
  complications: string[];
  interventions: string[];
  disposition: string | null;
  admission_date: string | null;
  discharge_date: string | null;
  metadata: Record<string, unknown>;
  source: 'auto_extracted' | 'manual' | 'edited';
  created_at: string;
  updated_at: string;
}

export interface PopulationQuery {
  teamId: string;
  from?: string;
  to?: string;
  diagnosis?: string;
  complication?: string;
  intervention?: string;
  disposition?: string;
  userId?: string;
  limit?: number;
  offset?: number;
}

export interface DiagnosisCount {
  primary_diagnosis: string;
  count: number;
}

export interface ComplicationCount {
  complication: string;
  count: number;
}

export class EncounterDataModel {
  // ---------------------------------------------------------------------------
  // CRUD
  // ---------------------------------------------------------------------------

  async create(input: {
    teamId: string;
    userId: string;
    noteId?: string;
    primaryDiagnosis?: string;
    diagnosisCodes?: string[];
    acuityScores?: Record<string, number>;
    complications?: string[];
    interventions?: string[];
    disposition?: string;
    admissionDate?: string;
    dischargeDate?: string;
    metadata?: Record<string, unknown>;
    source?: 'auto_extracted' | 'manual' | 'edited';
  }): Promise<EncounterData> {
    const pool = getPool();
    const id = randomUUID();
    await pool.query(
      `INSERT INTO encounter_data (id, team_id, user_id, note_id, primary_diagnosis, diagnosis_codes,
        acuity_scores, complications, interventions, disposition, admission_date, discharge_date, metadata, source)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
      [
        id, input.teamId, input.userId, input.noteId ?? null,
        input.primaryDiagnosis ?? null,
        JSON.stringify(input.diagnosisCodes ?? []),
        JSON.stringify(input.acuityScores ?? {}),
        JSON.stringify(input.complications ?? []),
        JSON.stringify(input.interventions ?? []),
        input.disposition ?? null,
        input.admissionDate ?? null,
        input.dischargeDate ?? null,
        JSON.stringify(input.metadata ?? {}),
        input.source ?? 'manual',
      ],
    );
    return (await this.findById(id))!;
  }

  async findById(id: string): Promise<EncounterData | null> {
    const pool = getPool();
    const result = await pool.query('SELECT * FROM encounter_data WHERE id = $1', [id]);
    return result.rows[0] ?? null;
  }

  async findByNoteId(noteId: string, teamId: string): Promise<EncounterData | null> {
    const pool = getPool();
    const result = await pool.query(
      'SELECT * FROM encounter_data WHERE note_id = $1 AND team_id = $2',
      [noteId, teamId],
    );
    return result.rows[0] ?? null;
  }

  async upsertByNoteId(input: {
    teamId: string;
    userId: string;
    noteId: string;
    primaryDiagnosis?: string;
    diagnosisCodes?: string[];
    acuityScores?: Record<string, number>;
    complications?: string[];
    interventions?: string[];
    disposition?: string;
    admissionDate?: string;
    dischargeDate?: string;
    metadata?: Record<string, unknown>;
    source?: 'auto_extracted' | 'manual' | 'edited';
  }): Promise<EncounterData> {
    const existing = await this.findByNoteId(input.noteId, input.teamId);
    if (existing) {
      return this.update(existing.id, input);
    }
    return this.create(input);
  }

  async update(id: string, fields: Partial<{
    primaryDiagnosis: string;
    diagnosisCodes: string[];
    acuityScores: Record<string, number>;
    complications: string[];
    interventions: string[];
    disposition: string;
    admissionDate: string;
    dischargeDate: string;
    metadata: Record<string, unknown>;
    source: string;
  }>): Promise<EncounterData> {
    const pool = getPool();
    const setClauses: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    const fieldMap: Record<string, { column: string; json: boolean }> = {
      primaryDiagnosis: { column: 'primary_diagnosis', json: false },
      diagnosisCodes: { column: 'diagnosis_codes', json: true },
      acuityScores: { column: 'acuity_scores', json: true },
      complications: { column: 'complications', json: true },
      interventions: { column: 'interventions', json: true },
      disposition: { column: 'disposition', json: false },
      admissionDate: { column: 'admission_date', json: false },
      dischargeDate: { column: 'discharge_date', json: false },
      metadata: { column: 'metadata', json: true },
      source: { column: 'source', json: false },
    };

    for (const [key, config] of Object.entries(fieldMap)) {
      if ((fields as any)[key] !== undefined) {
        setClauses.push(`${config.column} = $${paramIndex++}`);
        values.push(config.json ? JSON.stringify((fields as any)[key]) : (fields as any)[key]);
      }
    }

    if (setClauses.length === 0) return (await this.findById(id))!;

    setClauses.push('updated_at = NOW()');
    values.push(id);

    await pool.query(
      `UPDATE encounter_data SET ${setClauses.join(', ')} WHERE id = $${paramIndex}`,
      values,
    );
    return (await this.findById(id))!;
  }

  async delete(id: string, userId: string): Promise<boolean> {
    const pool = getPool();
    const result = await pool.query(
      'DELETE FROM encounter_data WHERE id = $1 AND user_id = $2',
      [id, userId],
    );
    return (result.rowCount ?? 0) > 0;
  }

  // ---------------------------------------------------------------------------
  // Population Queries
  // ---------------------------------------------------------------------------

  async query(q: PopulationQuery): Promise<{ encounters: EncounterData[]; total: number }> {
    const pool = getPool();
    const conditions = ['team_id = $1'];
    const values: any[] = [q.teamId];
    let paramIndex = 2;

    if (q.from) { conditions.push(`created_at >= $${paramIndex++}`); values.push(q.from); }
    if (q.to) { conditions.push(`created_at <= $${paramIndex++}`); values.push(q.to); }
    if (q.userId) { conditions.push(`user_id = $${paramIndex++}`); values.push(q.userId); }
    if (q.diagnosis) {
      conditions.push(`primary_diagnosis ILIKE $${paramIndex++}`);
      values.push(`%${q.diagnosis}%`);
    }
    if (q.complication) {
      conditions.push(`complications @> $${paramIndex++}::jsonb`);
      values.push(JSON.stringify([q.complication]));
    }
    if (q.intervention) {
      conditions.push(`interventions @> $${paramIndex++}::jsonb`);
      values.push(JSON.stringify([q.intervention]));
    }
    if (q.disposition) {
      conditions.push(`disposition = $${paramIndex++}`);
      values.push(q.disposition);
    }

    const whereClause = conditions.join(' AND ');

    const countResult = await pool.query(
      `SELECT COUNT(*)::int AS total FROM encounter_data WHERE ${whereClause}`,
      values,
    );

    const limit = Math.min(q.limit ?? 100, 500);
    const offset = q.offset ?? 0;
    values.push(limit, offset);

    const result = await pool.query(
      `SELECT * FROM encounter_data WHERE ${whereClause}
       ORDER BY created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      values,
    );

    return { encounters: result.rows, total: countResult.rows[0].total };
  }

  async diagnosisCounts(teamId: string, opts: { from?: string; to?: string } = {}): Promise<DiagnosisCount[]> {
    const pool = getPool();
    const conditions = ['team_id = $1', 'primary_diagnosis IS NOT NULL'];
    const values: any[] = [teamId];
    let paramIndex = 2;

    if (opts.from) { conditions.push(`created_at >= $${paramIndex++}`); values.push(opts.from); }
    if (opts.to) { conditions.push(`created_at <= $${paramIndex++}`); values.push(opts.to); }

    const result = await pool.query(
      `SELECT primary_diagnosis, COUNT(*)::int AS count
       FROM encounter_data WHERE ${conditions.join(' AND ')}
       GROUP BY primary_diagnosis ORDER BY count DESC`,
      values,
    );
    return result.rows;
  }

  async complicationCounts(teamId: string, opts: { from?: string; to?: string } = {}): Promise<ComplicationCount[]> {
    const pool = getPool();
    const conditions = ['team_id = $1'];
    const values: any[] = [teamId];
    let paramIndex = 2;

    if (opts.from) { conditions.push(`created_at >= $${paramIndex++}`); values.push(opts.from); }
    if (opts.to) { conditions.push(`created_at <= $${paramIndex++}`); values.push(opts.to); }

    const result = await pool.query(
      `SELECT elem AS complication, COUNT(*)::int AS count
       FROM encounter_data, jsonb_array_elements_text(complications) AS elem
       WHERE ${conditions.join(' AND ')}
       GROUP BY elem ORDER BY count DESC`,
      values,
    );
    return result.rows;
  }

  async acuityAverages(teamId: string, opts: { from?: string; to?: string } = {}): Promise<Record<string, number>> {
    const pool = getPool();
    const conditions = ['team_id = $1', "acuity_scores != '{}'::jsonb"];
    const values: any[] = [teamId];
    let paramIndex = 2;

    if (opts.from) { conditions.push(`created_at >= $${paramIndex++}`); values.push(opts.from); }
    if (opts.to) { conditions.push(`created_at <= $${paramIndex++}`); values.push(opts.to); }

    const result = await pool.query(
      `SELECT key, AVG(value::numeric)::float AS avg_score, COUNT(*)::int AS count
       FROM encounter_data, jsonb_each_text(acuity_scores) AS kv(key, value)
       WHERE ${conditions.join(' AND ')}
       GROUP BY key ORDER BY key`,
      values,
    );

    const averages: Record<string, number> = {};
    for (const row of result.rows) {
      averages[row.key] = Math.round(row.avg_score * 10) / 10;
    }
    return averages;
  }

  async dispositionCounts(teamId: string, opts: { from?: string; to?: string } = {}): Promise<{ disposition: string; count: number }[]> {
    const pool = getPool();
    const conditions = ['team_id = $1', 'disposition IS NOT NULL'];
    const values: any[] = [teamId];
    let paramIndex = 2;

    if (opts.from) { conditions.push(`created_at >= $${paramIndex++}`); values.push(opts.from); }
    if (opts.to) { conditions.push(`created_at <= $${paramIndex++}`); values.push(opts.to); }

    const result = await pool.query(
      `SELECT disposition, COUNT(*)::int AS count
       FROM encounter_data WHERE ${conditions.join(' AND ')}
       GROUP BY disposition ORDER BY count DESC`,
      values,
    );
    return result.rows;
  }
}
