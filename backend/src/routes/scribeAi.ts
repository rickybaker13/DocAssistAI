import { Router, Request, Response } from 'express';
import { scribeAuthMiddleware } from '../middleware/scribeAuth';
import { aiService } from '../services/ai/aiService';

const router = Router();
router.use(scribeAuthMiddleware);

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

  const specialty = userContext?.specialty || 'Medicine';
  const sectionList = sections
    .map((s: any) => `- ${s.name}${s.promptHint ? ` (Focus: ${s.promptHint})` : ''}`)
    .join('\n');

  const verbosityInstruction =
    verbosity === 'brief'
      ? '\nWrite concisely. Use bullet points where appropriate. No more than 1–2 sentences per item. Omit filler phrases.'
      : verbosity === 'detailed'
      ? '\nWrite in full prose with complete sentences. Include all clinically relevant detail, context, and nuance.'
      : '';

  const systemPrompt = `You are a clinical documentation AI assistant for a ${specialty} physician.
Generate structured note content for each section listed below, based ONLY on the transcript provided.
Write in first-person plural physician voice ("We assessed...", "The patient was...", "Our plan includes...").
Be clinically precise. Do not fabricate findings not present in the transcript.
If a section cannot be completed from the transcript, write: "Insufficient information captured."
Return ONLY valid JSON — no markdown fences, no extra text.${verbosityInstruction}`;

  const userPrompt = `Transcript:
"${transcript}"

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
        options: { temperature: 0.3 },
      },
      { userId: req.scribeUserId }
    );

    const text = extractContent(raw);

    let parsed: { sections: Array<{ name: string; content: string; confidence: number }> };
    try {
      const cleaned = text.replace(/```json?/g, '').replace(/```/g, '').trim();
      parsed = JSON.parse(cleaned);
    } catch {
      return res.json({
        sections: [{ name: 'Note', content: text, confidence: 0.5 }],
        parseError: true,
      });
    }

    return res.json({ sections: parsed.sections });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/ai/scribe/focused ─────────────────────────────────────────────
router.post('/focused', async (req: Request, res: Response) => {
  const { sectionName, content, transcript, specialty = 'Medicine' } = req.body;

  if (!sectionName || !content) {
    return res.status(400).json({ error: 'sectionName and content are required' }) as any;
  }

  const systemPrompt = `You are a senior ${specialty} physician AI providing expert clinical analysis.
Analyze the provided note section and return structured JSON only — no markdown, no extra text.`;

  const userPrompt = `Analyze this note section and provide deep clinical insight.

Section: ${sectionName}
Content: "${content}"
${transcript ? `Original transcript excerpt: "${transcript.slice(0, 500)}"` : ''}
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

    return res.json(parsed);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
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

  // Verbosity-specific writing instructions
  const verbosityInstruction =
    verbosity === 'brief'
      ? `Write in clinical shorthand using standard medical abbreviations. Use sentence fragments — do NOT write complete sentences.
Style example: "D/C CTX (ESBL-producing); start meropenem 1g IV q8h, renally adj. ID consult placed. Cont vanco only if GPO source confirmed."`
      : verbosity === 'detailed'
      ? `Write in complete clinical prose with full sentences. Include clinical reasoning and context where relevant.`
      : `Write 1–2 concise clinical sentences. Use medical abbreviations where natural (e.g., IV, q8h, D/C, s/p).`;

  const systemPrompt = `You are a clinical documentation AI. Convert clinical information into physician note text.
Output ONLY the note text — no explanation, no JSON, no markdown, no preamble.
Never include notes about transcription quality, source artifacts, uncertainty about the source material, or any meta-commentary.
Never include caveats, disclaimers, or any text that would not appear verbatim in a physician's clinical note.`;

  const userPrompt = `Convert the following clinical information into note text for the "${destinationSection}" section.
${verbosityInstruction}
Match the style of the existing section content if provided.

Clinical information:
"${chatAnswer}"

Note type: ${noteType}
Specialty: ${specialty}
${existingContent ? `Existing section content (match this style): "${existingContent.slice(0, 300)}"` : ''}

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

    const ghostWritten = extractContent(raw).trim();
    return res.json({ ghostWritten });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
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

  const verbosityInstruction =
    verbosity === 'brief'
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
Never include the suggestion text itself, meta-commentary, caveats, or guidance — only note-ready clinical content.

Return ONLY valid JSON. No markdown fences. No extra text.`;

  const userPrompt = `Suggestion to resolve: "${suggestion}"

Section: ${sectionName}
Note type: ${noteType}
Specialty: ${specialty}
${existingContent ? `Existing section content:\n"${existingContent.slice(0, 400)}"` : ''}
${transcript ? `Transcript excerpt:\n"${transcript.slice(0, 800)}"` : ''}

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

    return res.json(parsed);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
