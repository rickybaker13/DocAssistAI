import { getPool } from '../database/db.js';
import { randomUUID } from 'crypto';

export interface CodingSession {
  id: string;
  coder_user_id: string;
  team_id: string;
  patient_name: string;
  mrn: string | null;
  date_of_service: string;
  provider_name: string;
  facility: string | null;
  note_type: string;
  icd10_codes: unknown[];
  cpt_codes: unknown[];
  em_level: unknown | null;
  missing_documentation: unknown[];
  coder_status: string;
  batch_week: string;
  created_at: string;
}

/** Compute the Monday (ISO week start) for a given date string (YYYY-MM-DD). */
export function computeBatchWeek(dateOfService: string): string {
  const d = new Date(dateOfService + 'T00:00:00Z');
  const day = d.getUTCDay(); // 0=Sun, 1=Mon, ...
  const diff = day === 0 ? -6 : 1 - day; // shift to Monday
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

function parseJsonField(val: unknown): unknown {
  if (typeof val === 'string') {
    try { return JSON.parse(val); } catch { return val; }
  }
  return val;
}

function normalizeDateField(val: unknown): string {
  if (val instanceof Date) return val.toISOString().slice(0, 10);
  if (typeof val === 'string') return val.slice(0, 10);
  return String(val);
}

function hydrateRow(row: Record<string, unknown>): CodingSession {
  return {
    ...row,
    date_of_service: normalizeDateField(row.date_of_service),
    batch_week: normalizeDateField(row.batch_week),
    icd10_codes: parseJsonField(row.icd10_codes) as unknown[],
    cpt_codes: parseJsonField(row.cpt_codes) as unknown[],
    em_level: row.em_level != null ? parseJsonField(row.em_level) : null,
    missing_documentation: parseJsonField(row.missing_documentation) as unknown[],
  } as CodingSession;
}

export interface CreateCodingSessionInput {
  coderUserId: string;
  teamId: string;
  patientName: string;
  mrn?: string;
  dateOfService: string;
  providerName: string;
  facility?: string;
  noteType: string;
  icd10Codes?: unknown[];
  cptCodes?: unknown[];
  emLevel?: unknown;
  missingDocumentation?: unknown[];
  coderStatus?: string;
}

export class CodingSessionModel {
  async create(input: CreateCodingSessionInput): Promise<CodingSession> {
    const pool = getPool();
    const id = randomUUID();
    const batchWeek = computeBatchWeek(input.dateOfService);
    await pool.query(
      `INSERT INTO coding_sessions
        (id, coder_user_id, team_id, patient_name, mrn, date_of_service, provider_name, facility, note_type, icd10_codes, cpt_codes, em_level, missing_documentation, coder_status, batch_week)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
      [
        id,
        input.coderUserId,
        input.teamId,
        input.patientName,
        input.mrn ?? null,
        input.dateOfService,
        input.providerName,
        input.facility ?? null,
        input.noteType,
        JSON.stringify(input.icd10Codes ?? []),
        JSON.stringify(input.cptCodes ?? []),
        input.emLevel != null ? JSON.stringify(input.emLevel) : null,
        JSON.stringify(input.missingDocumentation ?? []),
        input.coderStatus ?? 'coded',
        batchWeek,
      ],
    );
    return (await this.findById(id))!;
  }

  async findById(id: string): Promise<CodingSession | null> {
    const pool = getPool();
    const result = await pool.query('SELECT * FROM coding_sessions WHERE id = $1', [id]);
    if (!result.rows[0]) return null;
    return hydrateRow(result.rows[0]);
  }

  async listByCoder(
    coderUserId: string,
    opts: { limit?: number; offset?: number } = {},
  ): Promise<CodingSession[]> {
    const pool = getPool();
    const limit = opts.limit ?? 50;
    const offset = opts.offset ?? 0;
    const result = await pool.query(
      `SELECT * FROM coding_sessions WHERE coder_user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [coderUserId, limit, offset],
    );
    return result.rows.map(hydrateRow);
  }

  async listByTeam(
    teamId: string,
    opts: { start?: string; end?: string } = {},
  ): Promise<CodingSession[]> {
    const pool = getPool();
    if (opts.start && opts.end) {
      const result = await pool.query(
        `SELECT * FROM coding_sessions WHERE team_id = $1 AND date_of_service >= $2 AND date_of_service <= $3 ORDER BY date_of_service DESC`,
        [teamId, opts.start, opts.end],
      );
      return result.rows.map(hydrateRow);
    }
    const result = await pool.query(
      `SELECT * FROM coding_sessions WHERE team_id = $1 ORDER BY date_of_service DESC`,
      [teamId],
    );
    return result.rows.map(hydrateRow);
  }

  async updateStatus(id: string, status: string): Promise<CodingSession | null> {
    const pool = getPool();
    await pool.query(
      `UPDATE coding_sessions SET coder_status = $1 WHERE id = $2`,
      [status, id],
    );
    return this.findById(id);
  }

  async deleteById(id: string): Promise<boolean> {
    const pool = getPool();
    const result = await pool.query('DELETE FROM coding_sessions WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
  }
}
