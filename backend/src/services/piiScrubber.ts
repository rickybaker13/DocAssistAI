// backend/src/services/piiScrubber.ts

export interface AnalyzerResult {
  entity_type: string;
  start: number;
  end: number;
  score: number;
}

export type SubstitutionMap = Record<string, string>; // token → original value

export interface ScrubResult {
  scrubbedFields: Record<string, string>;
  subMap: SubstitutionMap;
}

export class PiiServiceUnavailableError extends Error {
  constructor(message?: string) {
    super(
      message ??
        'PII scrubbing service unavailable. Patient data cannot be sent to AI until de-identification is restored.'
    );
    this.name = 'PiiServiceUnavailableError';
  }
}

const UNAVAILABLE_MSG =
  'PII scrubbing service unavailable. Patient data cannot be sent to AI until de-identification is restored.';

// ── Internal: call Presidio Analyzer ─────────────────────────────────────────

async function analyzeText(text: string): Promise<AnalyzerResult[]> {
  const analyzerUrl = (process.env.PRESIDIO_ANALYZER_URL || 'http://localhost:5002').trim().replace(/\/+$/, '');
  const timeoutMs = parseInt(process.env.PRESIDIO_TIMEOUT_MS || '5000', 10);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${analyzerUrl}/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, language: 'en' }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new PiiServiceUnavailableError(UNAVAILABLE_MSG);
    }

    return response.json() as Promise<AnalyzerResult[]>;
  } catch (err: any) {
    if (err instanceof PiiServiceUnavailableError) throw err;
    // Network errors, AbortError (timeout), parse errors
    throw new PiiServiceUnavailableError(UNAVAILABLE_MSG);
  } finally {
    clearTimeout(timer);
  }
}

// ── Internal: deduplicate overlapping spans ───────────────────────────────────

/**
 * Remove overlapping entity spans, keeping the highest-scoring one.
 * If scores are equal, the longer span wins. Prevents token corruption
 * when e.g. DATE_OF_BIRTH and DATE_TIME both match the same text region.
 */
function deduplicateEntities(entities: AnalyzerResult[]): AnalyzerResult[] {
  // Sort by score descending, then span length descending (best candidates first)
  const sorted = [...entities].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return (b.end - b.start) - (a.end - a.start);
  });

  const kept: AnalyzerResult[] = [];
  for (const entity of sorted) {
    const overlaps = kept.some((k) => entity.start < k.end && entity.end > k.start);
    if (!overlaps) kept.push(entity);
  }

  return kept;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Scrub PII from all fields. One shared subMap spans all fields so the same
 * original value always maps to the same token regardless of which field it
 * appears in. Throws PiiServiceUnavailableError if Presidio is unreachable.
 */
async function scrub(fields: Record<string, string>): Promise<ScrubResult> {
  const minScore = parseFloat(process.env.PRESIDIO_MIN_SCORE || '0.7');
  const subMap: SubstitutionMap = {};
  const valueToToken = new Map<string, string>(); // dedup: same value → same token
  const typeCounts: Record<string, number> = {};
  const scrubbedFields: Record<string, string> = {};

  for (const [fieldName, text] of Object.entries(fields)) {
    if (!text) {
      scrubbedFields[fieldName] = text;
      continue;
    }

    const results = await analyzeText(text); // throws PiiServiceUnavailableError on failure

    // Filter by confidence, deduplicate overlapping spans, then sort ascending
    const filteredAscending = deduplicateEntities(
      results.filter((r) => r.score >= minScore)
    ).sort((a, b) => a.start - b.start);

    // First pass (ascending): assign tokens in order of appearance in the text
    for (const entity of filteredAscending) {
      const originalValue = text.slice(entity.start, entity.end); // always from original text

      if (!valueToToken.has(originalValue)) {
        const count = typeCounts[entity.entity_type] ?? 0;
        const token = `[${entity.entity_type}_${count}]`;
        typeCounts[entity.entity_type] = count + 1;
        valueToToken.set(originalValue, token);
        subMap[token] = originalValue;
      }
    }

    // Second pass (descending): replace spans in reverse order to preserve earlier indices
    const filteredDescending = [...filteredAscending].sort((a, b) => b.start - a.start);
    let scrubbed = text;
    for (const entity of filteredDescending) {
      const originalValue = text.slice(entity.start, entity.end); // always from original text
      const token = valueToToken.get(originalValue)!;

      // Replace span in the working string (reverse order keeps earlier indices valid)
      scrubbed = scrubbed.slice(0, entity.start) + token + scrubbed.slice(entity.end);
    }

    scrubbedFields[fieldName] = scrubbed;
  }

  return { scrubbedFields, subMap };
}

/**
 * Re-inject original values into LLM response text. Pure synchronous function —
 * no I/O, no side effects. Replaces every occurrence of each token globally.
 */
function reInject(text: string, subMap: SubstitutionMap): string {
  let result = text;
  for (const [token, original] of Object.entries(subMap)) {
    // Escape [ and ] since they are regex metacharacters
    const escaped = token.replace(/[[\]]/g, '\\$&');
    const safeOriginal = original.replace(/\$/g, '$$$$');
    result = result.replace(new RegExp(escaped, 'g'), safeOriginal);
  }
  return result;
}

// Singleton export — enables jest.spyOn(piiScrubber, 'scrub') in tests
export const piiScrubber = { scrub, reInject };
