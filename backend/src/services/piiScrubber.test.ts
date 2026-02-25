import { jest, describe, it, expect, afterEach } from '@jest/globals';

// Mock globalThis.fetch BEFORE importing the module under test
const mockFetch = jest.fn<typeof fetch>();
(globalThis as any).fetch = mockFetch;

import { piiScrubber, PiiServiceUnavailableError } from './piiScrubber.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeAnalyzerResponse(results: object[]) {
  return {
    ok: true,
    json: async () => results,
  } as unknown as Response;
}

function makeAnalyzerError(status = 503) {
  return {
    ok: false,
    status,
    json: async () => ({ error: 'Service unavailable' }),
  } as unknown as Response;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('piiScrubber', () => {
  afterEach(() => {
    mockFetch.mockReset();
  });

  // ── scrub() ──────────────────────────────────────────────────────────────

  describe('scrub()', () => {
    it('scrubs a PERSON entity and builds the correct subMap', async () => {
      // "John Smith" occupies positions 11-21 in "Patient is John Smith today."
      mockFetch.mockResolvedValue(makeAnalyzerResponse([
        { entity_type: 'PERSON', start: 11, end: 21, score: 0.95 },
      ]));

      const { scrubbedFields, subMap } = await piiScrubber.scrub({
        transcript: 'Patient is John Smith today.',
      });

      expect(scrubbedFields.transcript).toBe('Patient is [PERSON_0] today.');
      expect(subMap['[PERSON_0]']).toBe('John Smith');
    });

    it('assigns unique numbered tokens to different values of the same entity type', async () => {
      // "John Smith" at 0-10, "Dr. Adams" at 15-24 in "John Smith saw Dr. Adams."
      mockFetch.mockResolvedValue(makeAnalyzerResponse([
        { entity_type: 'PERSON', start: 0, end: 10, score: 0.95 },
        { entity_type: 'PERSON', start: 15, end: 24, score: 0.90 },
      ]));

      const { subMap } = await piiScrubber.scrub({
        transcript: 'John Smith saw Dr. Adams.',
      });

      expect(Object.keys(subMap)).toHaveLength(2);
      expect(subMap['[PERSON_0]']).toBe('John Smith');
      expect(subMap['[PERSON_1]']).toBe('Dr. Adams');
    });

    it('assigns the same token when the same value appears twice', async () => {
      // "John Smith" at 0-10 and 17-27 in "John Smith here. John Smith again."
      mockFetch.mockResolvedValue(makeAnalyzerResponse([
        { entity_type: 'PERSON', start: 0, end: 10, score: 0.95 },
        { entity_type: 'PERSON', start: 17, end: 27, score: 0.90 },
      ]));

      const { scrubbedFields, subMap } = await piiScrubber.scrub({
        transcript: 'John Smith here. John Smith again.',
      });

      expect(Object.keys(subMap)).toHaveLength(1);
      expect(subMap['[PERSON_0]']).toBe('John Smith');
      expect(scrubbedFields.transcript).toBe('[PERSON_0] here. [PERSON_0] again.');
    });

    it('replaces spans in reverse order to preserve correct character indices', async () => {
      // "Jane" at 0-4, "03/15/1965" at 14-24 in "Jane admitted 03/15/1965."
      mockFetch.mockResolvedValue(makeAnalyzerResponse([
        { entity_type: 'PERSON', start: 0, end: 4, score: 0.95 },
        { entity_type: 'DATE_TIME', start: 14, end: 24, score: 0.90 },
      ]));

      const { scrubbedFields } = await piiScrubber.scrub({
        transcript: 'Jane admitted 03/15/1965.',
      });

      expect(scrubbedFields.transcript).toBe('[PERSON_0] admitted [DATE_TIME_0].');
    });

    it('skips entities below PRESIDIO_MIN_SCORE threshold', async () => {
      mockFetch.mockResolvedValue(makeAnalyzerResponse([
        { entity_type: 'PERSON', start: 0, end: 10, score: 0.5 }, // below 0.7 → skip
        { entity_type: 'DATE_TIME', start: 14, end: 24, score: 0.9 }, // above → redact
      ]));

      const { scrubbedFields, subMap } = await piiScrubber.scrub({
        transcript: 'John Smith on 01/01/2000.',
      });

      // Low-confidence PERSON is NOT redacted
      expect(scrubbedFields.transcript).toContain('John Smith');
      // High-confidence DATE is redacted
      expect(Object.keys(subMap)).toHaveLength(1);
    });

    it('scrubs multiple fields and shares one subMap (same value → same token across fields)', async () => {
      // field1: "John Smith" at 0-10; field2: "John Smith" at 11-21
      mockFetch
        .mockResolvedValueOnce(makeAnalyzerResponse([
          { entity_type: 'PERSON', start: 0, end: 10, score: 0.95 },
        ]))
        .mockResolvedValueOnce(makeAnalyzerResponse([
          { entity_type: 'PERSON', start: 11, end: 21, score: 0.90 },
        ]));

      const { scrubbedFields, subMap } = await piiScrubber.scrub({
        field1: 'John Smith is the patient.',
        field2: 'Patient is John Smith.',
      });

      // Same value in both fields → same token
      expect(scrubbedFields.field1).toContain('[PERSON_0]');
      expect(scrubbedFields.field2).toContain('[PERSON_0]');
      expect(Object.keys(subMap)).toHaveLength(1);
    });

    it('handles empty string input gracefully without calling Presidio', async () => {
      const { scrubbedFields, subMap } = await piiScrubber.scrub({
        transcript: '',
      });

      expect(scrubbedFields.transcript).toBe('');
      expect(Object.keys(subMap)).toHaveLength(0);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('handles text with no PII detected', async () => {
      mockFetch.mockResolvedValue(makeAnalyzerResponse([]));

      const { scrubbedFields, subMap } = await piiScrubber.scrub({
        transcript: 'Blood pressure was elevated.',
      });

      expect(scrubbedFields.transcript).toBe('Blood pressure was elevated.');
      expect(Object.keys(subMap)).toHaveLength(0);
    });

    it('throws PiiServiceUnavailableError when Presidio returns a non-ok status', async () => {
      mockFetch.mockResolvedValue(makeAnalyzerError(503));

      await expect(
        piiScrubber.scrub({ transcript: 'John Smith.' })
      ).rejects.toThrow(PiiServiceUnavailableError);
    });

    it('throws PiiServiceUnavailableError when fetch throws a network error', async () => {
      mockFetch.mockRejectedValue(new Error('ECONNREFUSED'));

      await expect(
        piiScrubber.scrub({ transcript: 'John Smith.' })
      ).rejects.toThrow(PiiServiceUnavailableError);
    });

    it('throws PiiServiceUnavailableError when fetch is aborted (timeout)', async () => {
      const abortErr = Object.assign(new Error('The operation was aborted'), { name: 'AbortError' });
      mockFetch.mockRejectedValue(abortErr);

      await expect(
        piiScrubber.scrub({ transcript: 'John Smith.' })
      ).rejects.toThrow(PiiServiceUnavailableError);
    });
  });

  // ── reInject() ────────────────────────────────────────────────────────────

  describe('reInject()', () => {
    it('restores all tokens to their original values', () => {
      const subMap = {
        '[PERSON_0]': 'John Smith',
        '[DATE_TIME_0]': '03/15/1965',
        '[MEDICAL_RECORD_NUMBER_0]': 'MRN#89234',
      };
      const text = 'Patient [PERSON_0] born [DATE_TIME_0] with chart [MEDICAL_RECORD_NUMBER_0].';

      expect(piiScrubber.reInject(text, subMap)).toBe(
        'Patient John Smith born 03/15/1965 with chart MRN#89234.'
      );
    });

    it('replaces all occurrences of the same token', () => {
      const subMap = { '[PERSON_0]': 'Dr. Adams' };
      const text = '[PERSON_0] consulted with [PERSON_0] by phone.';

      expect(piiScrubber.reInject(text, subMap)).toBe(
        'Dr. Adams consulted with Dr. Adams by phone.'
      );
    });

    it('returns text unchanged when subMap is empty', () => {
      const text = 'No tokens here.';
      expect(piiScrubber.reInject(text, {})).toBe(text);
    });

    it('correctly restores values that contain $ characters', () => {
      const subMap = { "[PERSON_0]": "O'Brien $& Co." };
      const text = "Patient [PERSON_0] was seen.";
      expect(piiScrubber.reInject(text, subMap)).toBe("Patient O'Brien $& Co. was seen.");
    });
  });
});
