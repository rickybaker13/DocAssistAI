import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { aiService } from '../services/ai/aiService.js';
import { piiScrubber, PiiServiceUnavailableError } from '../services/piiScrubber.js';
import { ScribeUserModel } from '../models/scribeUser.js';

const TOKEN_PRESERVATION_INSTRUCTION = `\nText may contain privacy-protection tokens in [TOKEN_N] format (e.g., [PERSON_0], [DATE_0], [MRN_0]). Preserve these tokens exactly as written — do not rephrase, remove, or modify any [BRACKET_N] token.`;

const DISCLAIMER = 'AI-suggested codes require professional review. These suggestions do not constitute medical coding advice. The coder is responsible for final code selection and compliance.';

const router = Router();
const userModel = new ScribeUserModel();

function aiErrorResponse(res: Response, err: any) {
  if (err?.isThrottling) {
    return res.status(429).json({ error: 'AI service is temporarily unavailable due to rate limits. Please wait a moment and try again.' });
  }
  return res.status(500).json({ error: err.message });
}

function extractContent(raw: unknown): string {
  if (typeof raw === 'string') return raw;
  if (raw && typeof (raw as any).content === 'string') return (raw as any).content;
  return '';
}

const extractCodesLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  keyGenerator: (req) => req.scribeUserId || req.ip || 'unknown',
  message: { error: 'Too many code extraction requests. Please wait a moment.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ─── POST /api/ai/scribe/coder/extract-codes ────────────────────────────────
router.post('/extract-codes', extractCodesLimiter, async (req: Request, res: Response) => {
  // ── Role check ──────────────────────────────────────────────────────────
  const user = await userModel.findById(req.scribeUserId!);
  if (!user || (user.user_role !== 'billing_coder' && user.user_role !== 'coding_manager')) {
    return res.status(403).json({ error: 'Access denied. Billing coder or coding manager role required.' }) as any;
  }

  const { noteText, noteType = 'progress_note', specialty = 'Medicine' } = req.body;

  // ── Validate request ────────────────────────────────────────────────────
  if (!noteText || typeof noteText !== 'string' || !noteText.trim()) {
    return res.status(400).json({ error: 'noteText is required' }) as any;
  }

  // ── PII De-identification ───────────────────────────────────────────────
  let scrubbedNote = noteText;
  let subMap: Record<string, string> = {};
  try {
    const result = await piiScrubber.scrub({ noteText });
    scrubbedNote = result.scrubbedFields.noteText;
    subMap = result.subMap;
  } catch (err) {
    if (err instanceof PiiServiceUnavailableError) {
      return res.status(503).json({ error: (err as Error).message }) as any;
    }
    throw err;
  }

  const systemPrompt = `You are an expert medical coder and ${specialty} physician AI.
Extract billing codes from the clinical note below. Return structured JSON only — no markdown, no extra text.

ICD-10-CM Coding Rules:
- Use the most specific code available (e.g., E11.65 not E11.9 when details support it)
- Specify laterality when applicable (Left, Right, Bilateral)
- Include 7th character extensions when required
- Distinguish acute/chronic/sequelae
- Use active codes for actively managed conditions, not "history of" codes
- Include secondary diagnoses for complications and comorbidities

CPT / E&M Coding Rules (2021 MDM-based framework):
- Base E&M level on medical decision-making complexity:
  - Number and complexity of problems addressed
  - Amount and complexity of data reviewed
  - Risk of complications, morbidity, or mortality
- 99211-99215 for established outpatient, 99221-99223 for initial inpatient, 99231-99233 for subsequent inpatient
- Include applicable add-on codes (prolonged services, critical care)
${TOKEN_PRESERVATION_INSTRUCTION}`;

  const userPrompt = `Analyze this clinical note and suggest billing codes.

Note Type: ${noteType.replace(/_/g, ' ')}
Specialty: ${specialty}

CLINICAL NOTE:
${scrubbedNote}

Return JSON:
{
  "icd10_codes": [
    {
      "code": "E11.9",
      "description": "Type 2 diabetes mellitus without complications",
      "confidence": 0.95,
      "supporting_text": "Brief quote from note supporting this code"
    }
  ],
  "cpt_codes": [
    {
      "code": "99223",
      "description": "Initial hospital care, high complexity",
      "confidence": 0.90,
      "reasoning": "High complexity MDM: multiple acute problems, extensive data review"
    }
  ],
  "em_level": {
    "suggested": "99223",
    "mdm_complexity": "High",
    "reasoning": "3+ acute/chronic conditions requiring management, ordered tests reviewed, high risk of morbidity"
  },
  "missing_documentation": [
    "Specific item that would strengthen coding if documented"
  ]
}

Include ALL relevant diagnosis codes found in the note. For CPT, suggest the primary E&M code and any applicable procedure codes. Keep supporting_text to 1-2 sentences max.`;

  try {
    const raw = await aiService.chat(
      {
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        options: { temperature: 0.2 },
      },
      { userId: req.scribeUserId }
    );

    const text = extractContent(raw);

    let parsed: any;
    try {
      const cleaned = text.replace(/```json?/g, '').replace(/```/g, '').trim();
      parsed = JSON.parse(cleaned);
    } catch {
      parsed = { icd10_codes: [], cpt_codes: [], em_level: null, missing_documentation: [] };
    }

    // Re-inject PII tokens
    if (Object.keys(subMap).length > 0) {
      if (Array.isArray(parsed.icd10_codes)) {
        parsed.icd10_codes = parsed.icd10_codes.map((c: any) => ({
          ...c,
          supporting_text: c.supporting_text ? piiScrubber.reInject(c.supporting_text, subMap) : c.supporting_text,
        }));
      }
      if (Array.isArray(parsed.cpt_codes)) {
        parsed.cpt_codes = parsed.cpt_codes.map((c: any) => ({
          ...c,
          reasoning: c.reasoning ? piiScrubber.reInject(c.reasoning, subMap) : c.reasoning,
        }));
      }
      if (parsed.em_level?.reasoning) {
        parsed.em_level.reasoning = piiScrubber.reInject(parsed.em_level.reasoning, subMap);
      }
      if (Array.isArray(parsed.missing_documentation)) {
        parsed.missing_documentation = parsed.missing_documentation.map((s: string) =>
          piiScrubber.reInject(s, subMap)
        );
      }
    }

    return res.json({
      ...parsed,
      disclaimer: DISCLAIMER,
    });
  } catch (err: any) {
    return aiErrorResponse(res, err);
  }
});

export default router;
