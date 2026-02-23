import { renderHook, act } from '@testing-library/react';
import { useScribeAuthStore } from './scribeAuthStore';

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('useScribeAuthStore', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    useScribeAuthStore.getState().reset();
  });

  it('starts with user=null and loading=false', () => {
    const { result } = renderHook(() => useScribeAuthStore());
    expect(result.current.user).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it('login — sets user on success', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ user: { id: '1', email: 'a@b.com', name: 'Test' } }),
    });
    const { result } = renderHook(() => useScribeAuthStore());
    await act(async () => {
      await result.current.login('a@b.com', 'password');
    });
    expect(result.current.user).toEqual({ id: '1', email: 'a@b.com', name: 'Test' });
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
    expect(result.current.error).toBe('Invalid credentials');
  });

  it('logout — clears user', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) });
    const { result } = renderHook(() => useScribeAuthStore());
    act(() => { useScribeAuthStore.setState({ user: { id: '1', email: 'a@b.com', name: null, specialty: null } }); });
    await act(async () => { await result.current.logout(); });
    expect(result.current.user).toBeNull();
  });
});
