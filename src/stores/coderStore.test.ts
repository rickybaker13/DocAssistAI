import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useCoderStore } from './coderStore';

beforeEach(() => {
  useCoderStore.getState().reset();
  vi.restoreAllMocks();
});

describe('coderStore', () => {
  it('starts with empty state', () => {
    const state = useCoderStore.getState();
    expect(state.extracting).toBe(false);
    expect(state.lastResult).toBeNull();
    expect(state.sessions).toEqual([]);
  });

  it('extractCodes sets extracting then stores result', async () => {
    const mockResult = {
      icd10_codes: [{ code: 'E11.9', description: 'T2DM', confidence: 0.9 }],
      cpt_codes: [],
      em_level: null,
      missing_documentation: [],
      disclaimer: 'Test',
    };
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResult,
    }) as any;

    const result = await useCoderStore.getState().extractCodes('test note');
    expect(result).toEqual(mockResult);
    expect(useCoderStore.getState().lastResult).toEqual(mockResult);
    expect(useCoderStore.getState().extracting).toBe(false);
  });

  it('extractCodes sets error on failure', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'PII service down' }),
    }) as any;

    const result = await useCoderStore.getState().extractCodes('test note');
    expect(result).toBeNull();
    expect(useCoderStore.getState().extractError).toBe('PII service down');
  });

  it('saveSession adds to sessions list', async () => {
    const mockSession = { id: 'sess-1', patient_name: 'Doe', coder_status: 'coded' };
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockSession,
    }) as any;

    const session = await useCoderStore.getState().saveSession({
      patientName: 'Doe', dateOfService: '2026-03-28', providerName: 'Dr. Smith',
      noteType: 'inpatient', icd10Codes: [], cptCodes: [], emLevel: null, missingDocumentation: [],
    });
    expect(session).toEqual(mockSession);
    expect(useCoderStore.getState().sessions).toHaveLength(1);
  });

  it('fetchSessions populates sessions', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ id: 's1' }, { id: 's2' }],
    }) as any;

    await useCoderStore.getState().fetchSessions();
    expect(useCoderStore.getState().sessions).toHaveLength(2);
    expect(useCoderStore.getState().sessionsLoading).toBe(false);
  });

  it('clearResult resets extraction state', () => {
    useCoderStore.setState({ lastResult: { icd10_codes: [], cpt_codes: [], em_level: null, missing_documentation: [], disclaimer: '' } });
    useCoderStore.getState().clearResult();
    expect(useCoderStore.getState().lastResult).toBeNull();
  });
});
