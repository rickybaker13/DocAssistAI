import { describe, it, expect } from 'vitest';
import { findCodingMatches } from './useCodingHighlights';

describe('findCodingMatches', () => {
  it('returns empty array for empty string', () => {
    expect(findCodingMatches('')).toEqual([]);
  });

  it('returns empty array when no vague terms present', () => {
    expect(findCodingMatches('Patient has essential (primary) hypertension.')).toHaveLength(0);
  });

  it('detects "high blood pressure" and returns correct positions', () => {
    const text = 'Patient has high blood pressure managed on lisinopril.';
    const matches = findCodingMatches(text);
    expect(matches).toHaveLength(1);
    expect(text.slice(matches[0].start, matches[0].end).toLowerCase()).toBe('high blood pressure');
  });

  it('detects "CHF" case-insensitively', () => {
    const text = 'Assessment: chf with reduced ejection fraction.';
    const matches = findCodingMatches(text);
    expect(matches.some(m => m.original.toLowerCase() === 'chf')).toBe(true);
  });

  it('does NOT flag "CHF" when already qualified with systolic', () => {
    const text = 'Acute on chronic systolic CHF with EF 30%.';
    const matches = findCodingMatches(text);
    expect(matches.find(m => m.original.toLowerCase() === 'chf')).toBeUndefined();
  });

  it('does NOT flag "heart failure" when already specific', () => {
    expect(findCodingMatches('Patient has acute systolic heart failure.')).toHaveLength(0);
  });

  it('detects multiple vague terms in one text', () => {
    const text = 'Dx: CHF, kidney disease.';
    expect(findCodingMatches(text).length).toBeGreaterThanOrEqual(2);
  });

  it('returns matches sorted by start position', () => {
    const matches = findCodingMatches('Patient has CHF and kidney disease.');
    for (let i = 1; i < matches.length; i++) {
      expect(matches[i].start).toBeGreaterThan(matches[i - 1].start);
    }
  });

  it('returns non-overlapping matches', () => {
    const matches = findCodingMatches('heart failure and heart failure again');
    for (let i = 1; i < matches.length; i++) {
      expect(matches[i].start).toBeGreaterThanOrEqual(matches[i - 1].end);
    }
  });

  it('includes the correct CmsTerm on each match', () => {
    const matches = findCodingMatches('Assessment: high blood pressure.');
    expect(matches[0].term.preferred[0]).toMatch(/hypertension/i);
  });

  it('detects "history of stroke" as flagged', () => {
    const matches = findCodingMatches('PMH: history of stroke, HTN.');
    expect(matches.some(m => m.term.vague.includes('history of stroke'))).toBe(true);
  });

  it('"stroke" is not separately flagged at same position when "history of stroke" matches', () => {
    const text = 'PMH: history of stroke, HTN.';
    const matches = findCodingMatches(text);
    // Should have exactly one match for this span - the longer "history of stroke", not the shorter "stroke"
    const strokeMatches = matches.filter(m =>
      m.original.toLowerCase() === 'stroke' || m.term.vague === 'history of stroke'
    );
    expect(strokeMatches).toHaveLength(1);
    expect(strokeMatches[0].term.vague).toBe('history of stroke');
  });

  it('does not flag "COPD" when "without acute exacerbation" appears nearby', () => {
    expect(findCodingMatches('COPD without acute exacerbation, stable.')).toHaveLength(0);
  });

  it('does NOT flag "CHF" when "acute on chronic" (space-separated) appears nearby', () => {
    expect(findCodingMatches('acute on chronic CHF')).toHaveLength(0);
  });
});
