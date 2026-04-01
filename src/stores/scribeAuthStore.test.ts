import { renderHook, act } from '@testing-library/react';
import { useScribeAuthStore } from './scribeAuthStore';
import { useScribeNoteStore } from './scribeNoteStore';

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('useScribeAuthStore', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    useScribeAuthStore.getState().reset();
    useScribeNoteStore.getState().reset();
  });

  it('starts with user=null and loading=false', () => {
    const { result } = renderHook(() => useScribeAuthStore());
    expect(result.current.user).toBeNull();
    expect(useScribeNoteStore.getState().encounters).toEqual([]);
    expect(result.current.loading).toBe(false);
    expect(result.current.subscriptionStatus).toBeNull();
  });

  it('login — sets user on success', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ user: { id: '1', email: 'a@b.com', name: 'Test', is_admin: false, billing_codes_enabled: false, user_role: 'clinician', coding_team_id: null } }),
    });
    const { result } = renderHook(() => useScribeAuthStore());
    await act(async () => {
      await result.current.login('a@b.com', 'password');
    });
    expect(result.current.user).toEqual({ id: '1', email: 'a@b.com', name: 'Test', is_admin: false, billing_codes_enabled: false, user_role: 'clinician', coding_team_id: null });
    expect(result.current.error).toBeNull();
  });

  it('login — sets error on failure', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Invalid credentials' }),
    });
    const { result } = renderHook(() => useScribeAuthStore());
    await act(async () => {
      await result.current.login('a@b.com', 'wrong');
    });
    expect(result.current.user).toBeNull();
    expect(useScribeNoteStore.getState().encounters).toEqual([]);
    expect(result.current.error).toBe('Invalid credentials');
  });


  it('login — clears persisted notes when switching users', async () => {
    useScribeNoteStore.setState({
      encounters: [{
        noteId: 'n1',
        noteType: 'progress_note',
        patientLabel: 'Patient A',
        verbosity: 'standard',
        transcript: 'old',
        sections: [],
        status: 'ready',
        error: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }],
    });

    useScribeAuthStore.setState({ user: { id: 'old-user', email: 'old@test.com', name: null, specialty: null, is_admin: false, billing_codes_enabled: false, user_role: 'clinician', coding_team_id: null } });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ user: { id: 'new-user', email: 'new@test.com', name: 'New', is_admin: false, billing_codes_enabled: false, user_role: 'clinician', coding_team_id: null } }),
    });

    const { result } = renderHook(() => useScribeAuthStore());
    await act(async () => {
      await result.current.login('new@test.com', 'password');
    });

    expect(useScribeNoteStore.getState().encounters).toEqual([]);
  });

  it('logout — clears user', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) });
    const { result } = renderHook(() => useScribeAuthStore());
    act(() => {
      useScribeNoteStore.setState({
        encounters: [{
          noteId: 'n1',
          noteType: 'progress_note',
          patientLabel: 'Patient A',
          verbosity: 'standard',
          transcript: 'old',
          sections: [],
          status: 'ready',
          error: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }],
      });
      useScribeAuthStore.setState({ user: { id: '1', email: 'a@b.com', name: null, specialty: null, is_admin: false, billing_codes_enabled: false, user_role: 'clinician', coding_team_id: null } });
    });
    await act(async () => { await result.current.logout(); });
    expect(result.current.user).toBeNull();
    expect(result.current.subscriptionStatus).toBeNull();
    expect(useScribeNoteStore.getState().encounters).toEqual([]);
  });

  it('reset — clears subscriptionStatus', () => {
    useScribeAuthStore.setState({
      user: { id: '1', email: 'a@b.com', name: 'Test', specialty: null, is_admin: false, billing_codes_enabled: false, user_role: 'clinician', coding_team_id: null },
      subscriptionStatus: {
        subscription_status: 'active',
        trial_ends_at: null,
        period_ends_at: null,
        cancelled_at: null,
        has_payment_method: true,
        billing_cycle: 'monthly',
      },
    });
    const { result } = renderHook(() => useScribeAuthStore());
    act(() => { result.current.reset(); });
    expect(result.current.user).toBeNull();
    expect(result.current.subscriptionStatus).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });
});
