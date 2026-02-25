import { useMemo } from 'react';
import { CMS_TERMS, CmsTerm } from '../lib/cms-terms';

export interface Match {
  start: number;
  end: number;
  original: string;
  term: CmsTerm;
}

/**
 * Pure function — exported for unit testing without React.
 * Scans text against CMS_TERMS, returns non-overlapping matches sorted by start.
 *
 * Longer vague phrases are evaluated first so that "history of stroke" takes
 * precedence over the shorter "stroke" entry when both could match.
 */
export function findCodingMatches(text: string): Match[] {
  if (!text) return [];
  const matches: Match[] = [];

  // Process longer terms first so multi-word phrases win over single-word subsets.
  const sortedTerms = [...CMS_TERMS].sort((a, b) => b.vague.length - a.vague.length);

  for (const term of sortedTerms) {
    const escaped = term.vague.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b(${escaped})\\b`, 'gi');
    let m: RegExpExecArray | null;

    while ((m = regex.exec(text)) !== null) {
      const start = m.index;
      const end = m.index + m[0].length;

      // Suppress if already-specific context detected nearby
      if (term.excludeContext) {
        const ctx = text.slice(Math.max(0, start - 40), Math.min(text.length, end + 40));
        if (new RegExp(term.excludeContext, 'i').test(ctx)) continue;
      }

      // Skip overlapping matches
      if (matches.some(e => start < e.end && end > e.start)) continue;

      matches.push({ start, end, original: m[0], term });
    }
  }

  return matches.sort((a, b) => a.start - b.start);
}

/** React hook: memoized match list, recomputed only when text changes. */
export function useCodingHighlights(text: string): Match[] {
  return useMemo(() => findCodingMatches(text), [text]);
}
