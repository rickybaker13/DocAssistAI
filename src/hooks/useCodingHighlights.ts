import { useMemo } from 'react';
import { CMS_TERMS, CmsTerm } from '../lib/cms-terms';

export interface Match {
  start: number;
  end: number;
  original: string;
  term: CmsTerm;
}

/** Characters to look before/after a match when evaluating excludeContext. */
const EXCLUDE_CONTEXT_WINDOW = 40;

/** Pre-compiled lookup: term vague string → { mainRegex, excludeRegex | null } */
interface CompiledTerm {
  term: CmsTerm;
  mainRegex: RegExp;
  excludeRegex: RegExp | null;
}

const COMPILED_TERMS: CompiledTerm[] = [...CMS_TERMS]
  .sort((a, b) => b.vague.length - a.vague.length)
  .map(term => {
    const escaped = term.vague.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const mainRegex = new RegExp(`\\b(${escaped})\\b`, 'gi');
    let excludeRegex: RegExp | null = null;
    if (term.excludeContext) {
      try {
        excludeRegex = new RegExp(term.excludeContext, 'i');
      } catch {
        console.warn(`[useCodingHighlights] Invalid excludeContext regex for "${term.vague}":`, term.excludeContext);
      }
    }
    return { term, mainRegex, excludeRegex };
  });

/**
 * Pure function — exported for unit testing without React.
 * Scans text against CMS_TERMS, returns non-overlapping matches sorted by start position.
 * Longer phrases are checked before shorter ones (prevents "stroke" consuming "history of stroke").
 */
export function findCodingMatches(text: string): Match[] {
  if (!text) return [];
  const matches: Match[] = [];

  for (const { term, mainRegex, excludeRegex } of COMPILED_TERMS) {
    // Reset lastIndex so the regex can be reused across calls (global flag side effect)
    mainRegex.lastIndex = 0;
    let m: RegExpExecArray | null;

    while ((m = mainRegex.exec(text)) !== null) {
      const start = m.index;
      const end = m.index + m[0].length;

      // Suppress if already-specific context detected nearby
      if (excludeRegex) {
        const ctx = text.slice(
          Math.max(0, start - EXCLUDE_CONTEXT_WINDOW),
          Math.min(text.length, end + EXCLUDE_CONTEXT_WINDOW)
        );
        if (excludeRegex.test(ctx)) continue;
      }

      // Skip overlapping matches (shorter terms that fall within an already-claimed span)
      if (matches.some(e => start < e.end && end > e.start)) continue;

      matches.push({ start, end, original: m[0], term });
    }
  }

  // Sort by start position (terms are processed in length order, not position order)
  return matches.sort((a, b) => a.start - b.start);
}

/** React hook: memoized match list, recomputed only when text changes. */
export function useCodingHighlights(text: string): Match[] {
  return useMemo(() => findCodingMatches(text), [text]);
}
