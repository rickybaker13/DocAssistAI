import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import ExcelJS from 'exceljs';
import { ScribeUserModel } from '../models/scribeUser.js';
import { CodingSessionModel, CodingSession } from '../models/codingSession.js';
import { getPool } from '../database/db.js';
import { decrypt } from '../services/encryption.js';

const router = Router();
const userModel = new ScribeUserModel();
const sessionModel = new CodingSessionModel();

const exportLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5,
  keyGenerator: (req) => req.scribeUserId || req.ip || 'unknown',
  message: { error: 'Too many export requests. Please wait a moment.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ─── GET / — Export coding sessions as spreadsheet ─────────────────────────
router.get('/', exportLimiter, async (req: Request, res: Response) => {
  const start = req.query.start as string | undefined;
  const end = req.query.end as string | undefined;
  const format = (req.query.format as string) || 'xlsx';

  if (!start || !end) {
    return res.status(400).json({ error: 'start and end query params are required (YYYY-MM-DD)' }) as any;
  }

  if (format !== 'xlsx' && format !== 'csv') {
    return res.status(400).json({ error: 'format must be xlsx or csv' }) as any;
  }

  const user = await userModel.findById(req.scribeUserId!);
  if (!user || (user.user_role !== 'billing_coder' && user.user_role !== 'coding_manager')) {
    return res.status(403).json({ error: 'Billing coder or coding manager role required' }) as any;
  }

  let sessions: CodingSession[];

  if (user.user_role === 'coding_manager' && user.coding_team_id) {
    sessions = await sessionModel.listByTeam(user.coding_team_id, { start, end });
  } else {
    // Coder: query own sessions with date range filter
    const pool = getPool();
    const result = await pool.query(
      `SELECT * FROM coding_sessions WHERE coder_user_id = $1 AND date_of_service >= $2 AND date_of_service <= $3 ORDER BY date_of_service DESC`,
      [user.id, start, end],
    );
    sessions = result.rows.map((row: Record<string, unknown>) => ({
      ...row,
      // Decrypt PHI fields stored with column-level encryption
      patient_name: decrypt(row.patient_name as string | null),
      mrn: decrypt(row.mrn as string | null),
      provider_name: decrypt(row.provider_name as string | null),
      facility: decrypt(row.facility as string | null),
      date_of_service: row.date_of_service instanceof Date
        ? row.date_of_service.toISOString().slice(0, 10)
        : String(row.date_of_service).slice(0, 10),
      batch_week: row.batch_week instanceof Date
        ? row.batch_week.toISOString().slice(0, 10)
        : String(row.batch_week).slice(0, 10),
      icd10_codes: typeof row.icd10_codes === 'string' ? JSON.parse(row.icd10_codes) : row.icd10_codes,
      cpt_codes: typeof row.cpt_codes === 'string' ? JSON.parse(row.cpt_codes) : row.cpt_codes,
      em_level: row.em_level != null ? (typeof row.em_level === 'string' ? JSON.parse(row.em_level) : row.em_level) : null,
      missing_documentation: typeof row.missing_documentation === 'string' ? JSON.parse(row.missing_documentation) : row.missing_documentation,
    })) as CodingSession[];
  }

  // Build workbook
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Coding Export');

  worksheet.columns = [
    { header: 'Patient Name', key: 'patientName', width: 20 },
    { header: 'MRN', key: 'mrn', width: 15 },
    { header: 'Date of Service', key: 'dateOfService', width: 15 },
    { header: 'Rendering Provider', key: 'providerName', width: 20 },
    { header: 'Facility', key: 'facility', width: 20 },
    { header: 'Note Type', key: 'noteType', width: 15 },
    { header: 'ICD-10 Dx 1', key: 'dx1', width: 12 },
    { header: 'ICD-10 Dx 2', key: 'dx2', width: 12 },
    { header: 'ICD-10 Dx 3', key: 'dx3', width: 12 },
    { header: 'ICD-10 Dx 4', key: 'dx4', width: 12 },
    { header: 'ICD-10 Dx 5', key: 'dx5', width: 12 },
    { header: 'ICD-10 Dx 6', key: 'dx6', width: 12 },
    { header: 'CPT Code', key: 'cptCode', width: 12 },
    { header: 'CPT Units', key: 'cptUnits', width: 10 },
    { header: 'E/M Level', key: 'emLevel', width: 12 },
    { header: 'E/M MDM Complexity', key: 'emMdm', width: 18 },
    { header: 'Missing Documentation', key: 'missingDocs', width: 30 },
    { header: 'Confidence (Avg)', key: 'confidence', width: 12 },
    { header: 'Coder Status', key: 'coderStatus', width: 12 },
  ];

  // Style header row
  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD6E4F0' },
    };
  });

  // Add data rows
  for (const s of sessions) {
    const icd10 = Array.isArray(s.icd10_codes) ? s.icd10_codes : [];
    const cpt = Array.isArray(s.cpt_codes) ? s.cpt_codes : [];
    const emLevel = s.em_level as { suggested?: string; mdm_complexity?: string } | null;
    const missingDocs = Array.isArray(s.missing_documentation) ? s.missing_documentation : [];

    // Compute average confidence across all icd10 + cpt scores
    const confidenceScores: number[] = [];
    for (const dx of icd10) {
      const c = (dx as { confidence?: number }).confidence;
      if (typeof c === 'number') confidenceScores.push(c);
    }
    for (const cp of cpt) {
      const c = (cp as { confidence?: number }).confidence;
      if (typeof c === 'number') confidenceScores.push(c);
    }
    const avgConfidence = confidenceScores.length > 0
      ? Math.round((confidenceScores.reduce((a, b) => a + b, 0) / confidenceScores.length) * 100) + '%'
      : '';

    worksheet.addRow({
      patientName: s.patient_name,
      mrn: s.mrn ?? '',
      dateOfService: s.date_of_service,
      providerName: s.provider_name,
      facility: s.facility ?? '',
      noteType: s.note_type,
      dx1: (icd10[0] as { code?: string })?.code ?? '',
      dx2: (icd10[1] as { code?: string })?.code ?? '',
      dx3: (icd10[2] as { code?: string })?.code ?? '',
      dx4: (icd10[3] as { code?: string })?.code ?? '',
      dx5: (icd10[4] as { code?: string })?.code ?? '',
      dx6: (icd10[5] as { code?: string })?.code ?? '',
      cptCode: (cpt[0] as { code?: string })?.code ?? '',
      cptUnits: 1,
      emLevel: emLevel?.suggested ?? '',
      emMdm: emLevel?.mdm_complexity ?? '',
      missingDocs: missingDocs.join('; '),
      confidence: avgConfidence,
      coderStatus: s.coder_status,
    });
  }

  // Send response
  if (format === 'csv') {
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="coding-export-${start}-to-${end}.csv"`);
    await workbook.csv.write(res);
    res.end();
  } else {
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="coding-export-${start}-to-${end}.xlsx"`);
    await workbook.xlsx.write(res);
    res.end();
  }
});

export default router;
