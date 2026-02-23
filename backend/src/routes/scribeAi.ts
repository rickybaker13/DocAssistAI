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
  const { transcript, sections, noteType, userContext } = req.body;

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

  const systemPrompt = `You are a clinical documentation AI assistant for a ${specialty} physician.
Generate structured note content for each section listed below, based ONLY on the transcript provided.
Write in first-person plural physician voice ("We assessed...", "The patient was...", "Our plan includes...").
Be clinically precise. Do not fabricate findings not present in the transcript.
If a section cannot be completed from the transcript, write: "Insufficient information captured."
Return ONLY valid JSON — no markdown fences, no extra text.`;

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
  } = req.body;

  if (!chatAnswer || !destinationSection) {
    return res.status(400).json({ error: 'chatAnswer and destinationSection are required' }) as any;
  }

  const systemPrompt = `You are a clinical documentation AI. Rewrite clinical information into physician note language.
Return ONLY the ghost-written text — no explanation, no JSON, no markdown. Just the note text.`;

  const userPrompt = `Rewrite the following clinical information as 1–3 sentences in first-person plural physician voice.
Match the clinical density and writing style of the existing section content.
The output should read as if the attending physician dictated it.

Clinical information to incorporate:
"${chatAnswer}"

Destination section: ${destinationSection}
Note type: ${noteType}
Specialty: ${specialty}
${existingContent ? `Existing section content (match this style): "${existingContent.slice(0, 300)}"` : ''}

Output ONLY the ghost-written sentences. No preamble.`;

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

export default router;
