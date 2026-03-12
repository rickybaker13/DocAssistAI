import { Router, Request, Response } from 'express';
import { scribeAuthMiddleware } from '../middleware/scribeAuth.js';
import { aiService } from '../services/ai/aiService.js';
import { piiScrubber, PiiServiceUnavailableError } from '../services/piiScrubber.js';


const ICD10_TERMINOLOGY_INSTRUCTION = `Use ICD-10-CM preferred terminology throughout. Examples: 'essential (primary) hypertension' not 'high blood pressure'; 'Type 2 diabetes mellitus' not 'diabetes' or 'diabetic'; specify systolic/diastolic and acute/chronic/acute-on-chronic for heart failure; 'COPD with acute exacerbation' or 'COPD without acute exacerbation' not 'COPD' alone; 'sequelae of CVA with [deficit]' not 'history of stroke' when deficits persist. Avoid 'history of [condition]' for conditions still actively managed — in ICD-10, 'history of' means fully resolved.`;

const TOKEN_PRESERVATION_INSTRUCTION = `\nText may contain privacy-protection tokens in [TOKEN_N] format (e.g., [PERSON_0], [DATE_0], [MRN_0]). Preserve these tokens exactly as written — do not rephrase, remove, or modify any [BRACKET_N] token.`;

const NO_TRANSCRIPT_DISCLAIMER = `\nNEVER reference "the transcript", "the recording", "the dictation", or any source material in your output. A physician's note never says "not included in the transcript" or "not mentioned in the recording." If information is missing or incomplete, use natural clinical language a physician would actually write — for example: "Further history to be obtained", "Details to be clarified on follow-up", "Not assessed at this encounter", "Will review and update", or simply omit the item. The note must read as if authored entirely by the clinician.`;

const router = Router();
router.use(scribeAuthMiddleware);

function aiErrorResponse(res: Response, err: any) {
  if (err?.isThrottling) {
    return res.status(429).json({ error: 'AI service is temporarily unavailable due to rate limits. Please wait a moment and try again.' });
  }
  return res.status(500).json({ error: err.message });
}

/**
 * Helper: extract text content from aiService.chat response.
 * The real service returns AIResponse { content: string }, but
 * in tests the mock returns a raw string directly.
 */
function extractContent(raw: unknown): string {
  if (typeof raw === 'string') return raw;
  if (raw && typeof (raw as any).content === 'string') return (raw as any).content;
  return '';
}

// ─── POST /api/ai/scribe/generate ────────────────────────────────────────────
router.post('/generate', async (req: Request, res: Response) => {
  const { transcript, sections, noteType, userContext, verbosity } = req.body;

  if (!transcript || !transcript.trim()) {
    return res.status(400).json({ error: 'transcript is required' }) as any;
  }
  if (!sections || !Array.isArray(sections) || sections.length === 0) {
    return res.status(400).json({ error: 'sections array is required and must be non-empty' }) as any;
  }

  // ── PII De-identification ─────────────────────────────────────────────────
  let scrubbedTranscript = transcript;
  let subMap: Record<string, string> = {};
  try {
    const result = await piiScrubber.scrub({ transcript });
    scrubbedTranscript = result.scrubbedFields.transcript;
    subMap = result.subMap;
  } catch (err) {
    if (err instanceof PiiServiceUnavailableError) {
      return res.status(503).json({ error: (err as Error).message }) as any;
    }
    throw err;
  }

  const specialty = userContext?.specialty || 'Medicine';
  const sectionList = sections
    .map((s: any) => `- ${s.name}${s.promptHint ? ` (Focus: ${s.promptHint})` : ''}`)
    .join('\n');

  const verbosityInstruction =
    verbosity === 'concise'
      ? '\nWrite in telegraphic clinical shorthand. Key facts only — one line per item max. Omit all filler, context, and reasoning. Example style: "CHF exac, EF 25%, started IV lasix 40 q12h".'
      : verbosity === 'brief'
      ? '\nWrite concisely. Use bullet points where appropriate. No more than 1–2 sentences per item. Omit filler phrases.'
      : verbosity === 'detailed'
      ? '\nWrite in full prose with complete sentences. Include all clinically relevant detail, context, and nuance.'
      : '';

  const systemPrompt = `You are a clinical documentation AI assistant for a ${specialty} physician.
Generate structured note content for each section listed below, based ONLY on the transcript provided.
Write in first-person plural physician voice ("We assessed...", "The patient was...", "Our plan includes...").
Be clinically precise. Do not fabricate findings not present in the transcript.
If a section cannot be completed from the transcript, write a natural clinical phrase such as "Further history to be obtained" or "Not assessed at this encounter" — never say "Insufficient information captured."

TEMPLATE-BASED SECTIONS: Some sections include a "TEMPLATE-BASED SECTION" marker with a default template of normal/negative findings. For these sections:
- Use the provided template as your starting baseline.
- Replace ONLY the specific system findings that are mentioned in the transcript with the patient's actual findings.
- Keep normal/negative findings INTACT for any system not addressed in the transcript.
- NEVER write "Insufficient information captured" for template-based sections — always output the full template with any transcript-based modifications.
- Preserve the exact format (system name followed by colon, findings).

Return ONLY valid JSON — no markdown fences, no extra text.${verbosityInstruction}
${ICD10_TERMINOLOGY_INSTRUCTION}${TOKEN_PRESERVATION_INSTRUCTION}${NO_TRANSCRIPT_DISCLAIMER}`;

  const userPrompt = `Transcript:
"${scrubbedTranscript}"

Generate content for these sections:
${sectionList}

Return JSON with this exact structure:
{
  "sections": [
    { "name": "Section Name", "content": "Section text here", "confidence": 0.0 }
  ]
}
Confidence is 0.0–1.0: 1.0 = fully supported by transcript, 0.0 = not in transcript at all.`;

  try {
    const raw = await aiService.chat(
      {
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        options: {
          temperature: 0.3,
          model: process.env.SCRIBE_GENERATE_MODEL || undefined,
        },
      },
      { userId: req.scribeUserId }
    );

    const text = extractContent(raw);

    let parsed: { sections: Array<{ name: string; content: string; confidence: number }> };
    try {
      const cleaned = text.replace(/```json?/g, '').replace(/```/g, '').trim();
      parsed = JSON.parse(cleaned);
    } catch {
      const fallbackContent = Object.keys(subMap).length > 0
        ? piiScrubber.reInject(text, subMap)
        : text;
      return res.json({
        sections: [{ name: 'Note', content: fallbackContent, confidence: 0.5 }],
        parseError: true,
      }) as any;
    }

    if (Object.keys(subMap).length > 0) {
      parsed.sections = parsed.sections.map((s: any) => ({
        ...s,
        content: piiScrubber.reInject(s.content ?? '', subMap),
      }));
    }

    return res.json({ sections: parsed.sections });
  } catch (err: any) {
    return aiErrorResponse(res, err);
  }
});

// ─── POST /api/ai/scribe/chart-generate ──────────────────────────────────────
router.post('/chart-generate', async (req: Request, res: Response) => {
  const { fragments, sections, noteType, verbosity } = req.body;

  if (!fragments || !Array.isArray(fragments) || fragments.length === 0) {
    return res.status(400).json({ error: 'fragments array is required and must be non-empty' }) as any;
  }
  if (!sections || !Array.isArray(sections) || sections.length === 0) {
    return res.status(400).json({ error: 'sections array is required and must be non-empty' }) as any;
  }

  // Combine fragments into labeled blocks
  const combined = fragments
    .map((f: { label: string; text: string }) => `--- ${f.label.toUpperCase()} ---\n${f.text}`)
    .join('\n\n');

  // ── PII De-identification ─────────────────────────────────────────────────
  let scrubbedChart = combined;
  let subMap: Record<string, string> = {};
  try {
    const result = await piiScrubber.scrub({ chartData: combined });
    scrubbedChart = result.scrubbedFields.chartData;
    subMap = result.subMap;
  } catch (err) {
    if (err instanceof PiiServiceUnavailableError) {
      return res.status(503).json({ error: (err as Error).message }) as any;
    }
    throw err;
  }

  const sectionList = sections
    .map((s: any) => `- ${s.name}${s.promptHint ? ` (Focus: ${s.promptHint})` : ''}`)
    .join('\n');

  const verbosityInstruction =
    verbosity === 'concise'
      ? '\nWrite in telegraphic clinical shorthand. Key facts only — one line per item max. Omit all filler, context, and reasoning.'
      : verbosity === 'brief'
      ? '\nWrite concisely. Use bullet points where appropriate. No more than 1–2 sentences per item. Omit filler phrases.'
      : verbosity === 'detailed'
      ? '\nWrite in full prose with complete sentences. Include all clinically relevant detail, context, and nuance.'
      : '';

  const systemPrompt = `You are a clinical documentation AI assistant.
Generate structured note content for each section listed below, based ONLY on the chart data provided.
Cross-reference labs, imaging, medication lists, and clinical notes to build a coherent clinical narrative.
Write in first-person plural physician voice ("We assessed...", "The patient was...", "Our plan includes...").
Be clinically precise. Do not fabricate findings not present in the chart data.
If a section cannot be completed from the chart data, write a natural clinical phrase such as "Further data to be reviewed" or "Not available in provided records."

TEMPLATE-BASED SECTIONS: Some sections include a "TEMPLATE-BASED SECTION" marker with a default template of normal/negative findings. For these sections:
- Use the provided template as your starting baseline.
- Replace ONLY the specific system findings that are present in the chart data with the patient's actual findings.
- Keep normal/negative findings INTACT for any system not addressed in the chart data.
- Preserve the exact format (system name followed by colon, findings).

Return ONLY valid JSON — no markdown fences, no extra text.${verbosityInstruction}
${ICD10_TERMINOLOGY_INSTRUCTION}${TOKEN_PRESERVATION_INSTRUCTION}`;

  const userPrompt = `Chart Data:
${scrubbedChart}

Generate content for these sections:
${sectionList}

Return JSON with this exact structure:
{
  "sections": [
    { "name": "Section Name", "content": "Section text here", "confidence": 0.0 }
  ]
}
Confidence is 0.0–1.0: 1.0 = fully supported by chart data, 0.0 = not in chart data at all.`;

  try {
    const raw = await aiService.chat(
      {
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        options: {
          temperature: 0.3,
          model: process.env.SCRIBE_GENERATE_MODEL || undefined,
        },
      },
      { userId: req.scribeUserId }
    );

    const text = extractContent(raw);

    let parsed: { sections: Array<{ name: string; content: string; confidence: number }> };
    try {
      const cleaned = text.replace(/```json?/g, '').replace(/```/g, '').trim();
      parsed = JSON.parse(cleaned);
    } catch {
      const fallbackContent = Object.keys(subMap).length > 0
        ? piiScrubber.reInject(text, subMap)
        : text;
      return res.json({
        sections: [{ name: 'Note', content: fallbackContent, confidence: 0.5 }],
        parseError: true,
      }) as any;
    }

    if (Object.keys(subMap).length > 0) {
      parsed.sections = parsed.sections.map((s: any) => ({
        ...s,
        content: piiScrubber.reInject(s.content ?? '', subMap),
      }));
    }

    return res.json({ sections: parsed.sections });
  } catch (err: any) {
    return aiErrorResponse(res, err);
  }
});

// ─── POST /api/ai/scribe/focused ─────────────────────────────────────────────
router.post('/focused', async (req: Request, res: Response) => {
  const { sectionName, content, transcript, specialty = 'Medicine' } = req.body;

  if (!sectionName || !content) {
    return res.status(400).json({ error: 'sectionName and content are required' }) as any;
  }

  // ── PII De-identification ─────────────────────────────────────────────────
  let scrubbedContent = content;
  let scrubbedTranscriptFocused = transcript ?? '';
  let subMapFocused: Record<string, string> = {};
  try {
    const result = await piiScrubber.scrub({
      content,
      transcript: transcript ?? '',
    });
    scrubbedContent = result.scrubbedFields.content;
    scrubbedTranscriptFocused = result.scrubbedFields.transcript;
    subMapFocused = result.subMap;
  } catch (err) {
    if (err instanceof PiiServiceUnavailableError) {
      return res.status(503).json({ error: (err as Error).message }) as any;
    }
    throw err;
  }

  const systemPrompt = `You are a senior ${specialty} physician AI providing expert clinical analysis.
Analyze the provided note section and return structured JSON only — no markdown, no extra text.
${ICD10_TERMINOLOGY_INSTRUCTION}${TOKEN_PRESERVATION_INSTRUCTION}${NO_TRANSCRIPT_DISCLAIMER}`;

  const userPrompt = `Analyze this note section and provide deep clinical insight.

Section: ${sectionName}
Content: "${scrubbedContent}"
${scrubbedTranscriptFocused ? `Original transcript excerpt: "${scrubbedTranscriptFocused.slice(0, 500)}"` : ''}
Specialty: ${specialty}

Return JSON:
{
  "analysis": "Expanded clinical reasoning and context for this section",
  "citations": [
    { "guideline": "Guideline name", "year": "2023", "recommendation": "Specific recommendation text" }
  ],
  "suggestions": ["Clinically relevant item the note may be missing", "Another suggestion"],
  "confidence_breakdown": "Which claims are well-supported vs inferred"
}

For ICU sections, cite: Surviving Sepsis Campaign, ARDS Network, PADIS guidelines, AHA/ACC, NCS.
For general medicine: UpToDate-style evidence summaries, ACC/AHA, IDSA.
Keep each field concise. Suggestions should be actionable one-liners.`;

  try {
    const raw = await aiService.chat(
      {
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        options: { temperature: 0.4 },
      },
      { userId: req.scribeUserId }
    );

    const text = extractContent(raw);

    let parsed: any;
    try {
      const cleaned = text.replace(/```json?/g, '').replace(/```/g, '').trim();
      parsed = JSON.parse(cleaned);
    } catch {
      parsed = { analysis: text, citations: [], suggestions: [], confidence_breakdown: '' };
    }

    if (Object.keys(subMapFocused).length > 0) {
      if (parsed.analysis) {
        parsed.analysis = piiScrubber.reInject(parsed.analysis, subMapFocused);
      }
      if (Array.isArray(parsed.suggestions)) {
        parsed.suggestions = parsed.suggestions.map((s: string) =>
          piiScrubber.reInject(s, subMapFocused)
        );
      }
      if (Array.isArray(parsed.citations)) {
        parsed.citations = parsed.citations.map((c: any) => ({
          ...c,
          recommendation: c.recommendation
            ? piiScrubber.reInject(c.recommendation, subMapFocused)
            : c.recommendation,
        }));
      }
      if (parsed.confidence_breakdown) {
        parsed.confidence_breakdown = piiScrubber.reInject(parsed.confidence_breakdown, subMapFocused);
      }
    }

    return res.json(parsed);
  } catch (err: any) {
    return aiErrorResponse(res, err);
  }
});

// ─── POST /api/ai/scribe/ghost-write ─────────────────────────────────────────
router.post('/ghost-write', async (req: Request, res: Response) => {
  const {
    chatAnswer,
    destinationSection,
    existingContent,
    noteType = 'progress_note',
    specialty = 'Medicine',
    verbosity = 'standard',
  } = req.body;

  if (!chatAnswer || !destinationSection) {
    return res.status(400).json({ error: 'chatAnswer and destinationSection are required' }) as any;
  }

  // ── PII De-identification ─────────────────────────────────────────────────
  let scrubbedChatAnswer = chatAnswer;
  let scrubbedExistingContent = existingContent ?? '';
  let subMapGhost: Record<string, string> = {};
  try {
    const result = await piiScrubber.scrub({
      chatAnswer,
      existingContent: existingContent ?? '',
    });
    scrubbedChatAnswer = result.scrubbedFields.chatAnswer;
    scrubbedExistingContent = result.scrubbedFields.existingContent;
    subMapGhost = result.subMap;
  } catch (err) {
    if (err instanceof PiiServiceUnavailableError) {
      return res.status(503).json({ error: (err as Error).message }) as any;
    }
    throw err;
  }

  // Verbosity-specific writing instructions
  const verbosityInstruction =
    verbosity === 'concise'
      ? `Write in telegraphic clinical shorthand. Key facts only — one line max. No complete sentences. Example: "Vanc trough 18, cont current dose, recheck AM".`
      : verbosity === 'brief'
      ? `Write in clinical shorthand using standard medical abbreviations. Use sentence fragments — do NOT write complete sentences.
Style example: "D/C CTX (ESBL-producing); start meropenem 1g IV q8h, renally adj. ID consult placed. Cont vanco only if GPO source confirmed."`
      : verbosity === 'detailed'
      ? `Write in complete clinical prose with full sentences. Include clinical reasoning and context where relevant.`
      : `Write 1–2 concise clinical sentences. Use medical abbreviations where natural (e.g., IV, q8h, D/C, s/p).`;

  const systemPrompt = `You are a clinical documentation AI. Convert clinical information into physician note text.
Output ONLY the note text — no explanation, no JSON, no markdown, no preamble.
Never include notes about transcription quality, source artifacts, uncertainty about the source material, or any meta-commentary.
Never include caveats, disclaimers, or any text that would not appear verbatim in a physician's clinical note.
${ICD10_TERMINOLOGY_INSTRUCTION}${TOKEN_PRESERVATION_INSTRUCTION}${NO_TRANSCRIPT_DISCLAIMER}`;

  const userPrompt = `Convert the following clinical information into note text for the "${destinationSection}" section.
${verbosityInstruction}
Match the style of the existing section content if provided.

Clinical information:
"${scrubbedChatAnswer}"

Note type: ${noteType}
Specialty: ${specialty}
${scrubbedExistingContent ? `Existing section content (match this style): "${scrubbedExistingContent.slice(0, 300)}"` : ''}

Output ONLY the note text. Nothing else.`;

  try {
    const raw = await aiService.chat(
      {
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        options: { temperature: 0.5 },
      },
      { userId: req.scribeUserId }
    );

    const ghostWritten = piiScrubber.reInject(extractContent(raw).trim(), subMapGhost);
    return res.json({ ghostWritten });
  } catch (err: any) {
    return aiErrorResponse(res, err);
  }
});

// ─── POST /api/ai/scribe/resolve-suggestion ──────────────────────────────────
router.post('/resolve-suggestion', async (req: Request, res: Response) => {
  const {
    suggestion,
    sectionName,
    existingContent = '',
    transcript = '',
    noteType = 'progress_note',
    verbosity = 'standard',
    specialty = 'Medicine',
  } = req.body;

  if (!suggestion || !sectionName) {
    return res.status(400).json({ error: 'suggestion and sectionName are required' }) as any;
  }

  // ── PII De-identification ─────────────────────────────────────────────────
  let scrubbedSuggestion = suggestion;
  let scrubbedExistingContentRS = existingContent;
  let scrubbedTranscriptRS = transcript;
  let subMapRS: Record<string, string> = {};
  try {
    const result = await piiScrubber.scrub({
      suggestion,
      existingContent,
      transcript,
    });
    scrubbedSuggestion = result.scrubbedFields.suggestion;
    scrubbedExistingContentRS = result.scrubbedFields.existingContent;
    scrubbedTranscriptRS = result.scrubbedFields.transcript;
    subMapRS = result.subMap;
  } catch (err) {
    if (err instanceof PiiServiceUnavailableError) {
      return res.status(503).json({ error: (err as Error).message }) as any;
    }
    throw err;
  }

  const verbosityInstruction =
    verbosity === 'concise'
      ? 'If ready, write in telegraphic clinical shorthand. Key facts only, one line max. No complete sentences.'
      : verbosity === 'brief'
      ? 'If ready, write in clinical shorthand with medical abbreviations. Sentence fragments OK.'
      : verbosity === 'detailed'
      ? 'If ready, write in complete clinical prose with full reasoning.'
      : 'If ready, write 1–2 concise clinical sentences with medical abbreviations where natural.';

  const systemPrompt = `You are a clinical documentation AI for a ${specialty} physician. Your job is to convert a documentation suggestion into actual physician note text.

First, search the provided transcript and existing section content for the clinical detail referenced in the suggestion.
- If the detail is present or unambiguously inferable → write the note text and return ready=true.
- If a clinically critical detail is genuinely absent → return ready=false with a single focused clinical question and exactly 3 options.

Rules for options when ready=false:
- Provide exactly 3 options — the most clinically common and specific answers to your question given this case context.
- Options must be real clinical values (e.g. "Left MCA", "HFrEF", "EF 35%") — not vague placeholders.
- Do NOT include escape options like "Not yet determined", "Unknown", or "Other" — the UI provides a free-text fallback.

Rules for note text when ready=true:
${verbosityInstruction}
Never include notes about transcription quality, source artifacts, uncertainty about the source material, or any meta-commentary.
Never include the suggestion text itself, caveats, or guidance — only note-ready clinical content.

Return ONLY valid JSON. No markdown fences. No extra text.
${ICD10_TERMINOLOGY_INSTRUCTION}${TOKEN_PRESERVATION_INSTRUCTION}${NO_TRANSCRIPT_DISCLAIMER}`;

  const userPrompt = `Suggestion to resolve: "${scrubbedSuggestion}"

Section: ${sectionName}
Note type: ${noteType}
Specialty: ${specialty}
${scrubbedExistingContentRS ? `Existing section content:\n"${scrubbedExistingContentRS.slice(0, 400)}"` : ''}
${scrubbedTranscriptRS ? `Transcript excerpt:\n"${scrubbedTranscriptRS.slice(0, 800)}"` : ''}

Return one of these two JSON shapes:
{ "ready": true, "noteText": "..." }
{ "ready": false, "question": "...", "options": ["<specific value>", "<specific value>", "<specific value>"] }`;

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
    let parsed: { ready: boolean; noteText?: string; question?: string; options?: string[] };
    try {
      const cleaned = text.replace(/```json?/g, '').replace(/```/g, '').trim();
      parsed = JSON.parse(cleaned);
    } catch {
      return res.status(500).json({ error: 'AI returned unexpected non-JSON response' }) as any;
    }

    // Runtime shape validation
    if (typeof parsed.ready !== 'boolean') {
      return res.status(500).json({ error: 'AI response missing required "ready" field' }) as any;
    }
    if (parsed.ready && typeof parsed.noteText !== 'string') {
      return res.status(500).json({ error: 'AI response missing noteText for ready=true' }) as any;
    }
    if (!parsed.ready && (!parsed.question || !Array.isArray(parsed.options))) {
      return res.status(500).json({ error: 'AI response missing question/options for ready=false' }) as any;
    }
    if (!parsed.ready && Array.isArray(parsed.options) && parsed.options.length < 1) {
      return res.status(500).json({ error: 'AI returned no options for the clarifying question' }) as any;
    }

    if (Object.keys(subMapRS).length > 0) {
      if (parsed.noteText) {
        parsed.noteText = piiScrubber.reInject(parsed.noteText, subMapRS);
      }
      if (parsed.question) {
        parsed.question = piiScrubber.reInject(parsed.question, subMapRS);
      }
      if (Array.isArray(parsed.options)) {
        parsed.options = parsed.options.map((opt: string) =>
          piiScrubber.reInject(opt, subMapRS)
        );
      }
    }

    return res.json(parsed);
  } catch (err: any) {
    return aiErrorResponse(res, err);
  }
});

// ── POST /api/ai/scribe/billing-codes ──────────────────────────────────────
router.post('/billing-codes', async (req: Request, res: Response) => {
  const { sections, transcript, noteType = 'progress_note', specialty = 'Medicine' } = req.body;

  if (!sections || !Array.isArray(sections) || sections.length === 0) {
    return res.status(400).json({ error: 'sections array is required' }) as any;
  }

  // Build combined note text from all sections
  const noteText = sections
    .map((s: { name: string; content: string }) => `${s.name.toUpperCase()}\n${s.content}`)
    .join('\n\n');

  // ── PII De-identification ─────────────────────────────────────────────
  let scrubbedNote = noteText;
  let scrubbedTranscript = transcript ?? '';
  let subMap: Record<string, string> = {};
  try {
    const result = await piiScrubber.scrub({
      note: noteText,
      transcript: transcript ?? '',
    });
    scrubbedNote = result.scrubbedFields.note;
    scrubbedTranscript = result.scrubbedFields.transcript;
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

${scrubbedTranscript ? `TRANSCRIPT EXCERPT (for additional context):\n${scrubbedTranscript.slice(0, 800)}` : ''}

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
      disclaimer: 'AI-suggested codes — clinician review and attestation required before submission.',
    });
  } catch (err: any) {
    return aiErrorResponse(res, err);
  }
});

export default router;
