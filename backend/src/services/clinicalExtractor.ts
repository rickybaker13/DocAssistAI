import { aiService } from './ai/aiService.js';
import { piiScrubber, PiiServiceUnavailableError } from './piiScrubber.js';

/**
 * Extract structured clinical data from note content using AI.
 *
 * Flow: PII scrub → AI extraction → parse JSON → re-inject PII
 *
 * Returns null if extraction fails (non-blocking — caller should handle gracefully).
 */

export interface ExtractedClinicalData {
  primaryDiagnosis: string | null;
  diagnosisCodes: string[];
  acuityScores: Record<string, number>;
  complications: string[];
  interventions: string[];
  disposition: string | null;
}

const EXTRACTION_PROMPT = `You are a clinical data extraction system. Extract structured clinical data from the following note content.

Return ONLY valid JSON with this exact structure — no markdown fences, no extra text:

{
  "primaryDiagnosis": "main reason for admission/encounter, e.g. subarachnoid hemorrhage, septic shock, STEMI",
  "diagnosisCodes": ["ICD-10 codes if identifiable, e.g. I60.9, A41.9"],
  "acuityScores": {"score_name": numeric_value},
  "complications": ["complications mentioned, e.g. VAP, DCI, CAUTI, pressure injury"],
  "interventions": ["procedures/interventions, e.g. intubation, EVD placement, central line, CRRT"],
  "disposition": "discharge/transfer status if mentioned: discharged, transferred_stepdown, transferred_floor, expired, hospice, or null"
}

Rules:
- For primaryDiagnosis: use the single most important diagnosis driving the encounter
- For acuityScores: extract any mentioned scores — APACHE II, SOFA, GCS, NIHSS, Hunt & Hess, RASS, CAM-ICU, etc. Use the score name as key and numeric value
- For complications: only include complications that actually occurred, not potential ones
- For interventions: include procedures performed, not planned
- For disposition: only include if explicitly stated in the note
- If a field has no data, use null for strings, empty array [] for arrays, empty object {} for scores
- Do NOT fabricate data — only extract what is explicitly in the text`;

export async function extractClinicalData(
  noteContent: string,
  noteType: string,
): Promise<ExtractedClinicalData | null> {
  if (!noteContent || noteContent.trim().length < 50) return null;

  try {
    // PII scrub the note content
    let scrubbedContent = noteContent;
    let subMap: Record<string, string> = {};
    try {
      const result = await piiScrubber.scrub({ noteContent });
      scrubbedContent = result.scrubbedFields.noteContent;
      subMap = result.subMap;
    } catch (err) {
      if (err instanceof PiiServiceUnavailableError) {
        // Fail closed — don't send unscrubbed PHI to LLM
        console.error('[ClinicalExtract] PII service unavailable, skipping extraction');
        return null;
      }
      throw err;
    }

    // Call AI
    const raw = await aiService.chat(
      {
        messages: [
          { role: 'system', content: EXTRACTION_PROMPT },
          {
            role: 'user',
            content: `Note type: ${noteType}\n\nNote content:\n${scrubbedContent}`,
          },
        ],
        options: {
          temperature: 0.1, // Very low — we want consistent, factual extraction
          maxTokens: 1024,
        },
      },
      {},
    );

    // Parse response
    const text = typeof raw === 'string' ? raw : (raw as any).content || '';
    const cleaned = text.replace(/```json?/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleaned);

    // Re-inject PII into the diagnosis field (it may contain patient-specific terms)
    const reInject = (val: string | null) =>
      val && Object.keys(subMap).length > 0 ? piiScrubber.reInject(val, subMap) : val;

    return {
      primaryDiagnosis: reInject(parsed.primaryDiagnosis ?? null),
      diagnosisCodes: Array.isArray(parsed.diagnosisCodes) ? parsed.diagnosisCodes : [],
      acuityScores: typeof parsed.acuityScores === 'object' && parsed.acuityScores !== null
        ? parsed.acuityScores : {},
      complications: Array.isArray(parsed.complications)
        ? parsed.complications.map((c: string) => reInject(c) || c) : [],
      interventions: Array.isArray(parsed.interventions)
        ? parsed.interventions.map((i: string) => reInject(i) || i) : [],
      disposition: reInject(parsed.disposition ?? null),
    };
  } catch (err) {
    console.error('[ClinicalExtract] Extraction failed:', err);
    return null;
  }
}
