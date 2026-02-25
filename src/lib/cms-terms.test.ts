import { describe, it, expect } from 'vitest';
import { CMS_TERMS, CmsTerm } from './cms-terms';

describe('CMS_TERMS dictionary', () => {
  it('exports a non-empty array of CmsTerm objects', () => {
    expect(Array.isArray(CMS_TERMS)).toBe(true);
    expect(CMS_TERMS.length).toBeGreaterThan(10);
  });

  it('every entry has required fields with non-empty values', () => {
    for (const term of CMS_TERMS) {
      expect(typeof term.vague).toBe('string');
      expect(term.vague.length).toBeGreaterThan(0);
      expect(Array.isArray(term.preferred)).toBe(true);
      expect(term.preferred.length).toBeGreaterThan(0);
      expect(typeof term.note).toBe('string');
      expect(term.note.length).toBeGreaterThan(0);
    }
  });

  it('vague field for "high blood pressure" entry exists', () => {
    const entry = CMS_TERMS.find(t => t.vague.toLowerCase().includes('high blood pressure'));
    expect(entry).toBeDefined();
    expect(entry!.preferred[0]).toMatch(/hypertension/i);
  });

  it('vague field for "CHF" entry exists and preferred terms specify type', () => {
    const entry = CMS_TERMS.find(t => t.vague === 'CHF');
    expect(entry).toBeDefined();
    expect(entry!.preferred.some(p => /systolic|diastolic/i.test(p))).toBe(true);
  });

  it('vague field for "diabetic nephritis" entry exists and preferred uses nephropathy', () => {
    const entry = CMS_TERMS.find(t => t.vague.toLowerCase().includes('diabetic nephritis'));
    expect(entry).toBeDefined();
    expect(entry!.preferred[0]).toMatch(/nephropathy/i);
  });

  it('no duplicate vague entries', () => {
    const vagueTerms = CMS_TERMS.map(t => t.vague.toLowerCase());
    const unique = new Set(vagueTerms);
    expect(unique.size).toBe(vagueTerms.length);
  });
});
