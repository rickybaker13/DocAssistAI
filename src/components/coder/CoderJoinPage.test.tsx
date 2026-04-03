import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { CoderJoinPage } from './CoderJoinPage';
import { vi, describe, it, expect, beforeEach } from 'vitest';

beforeEach(() => {
  vi.restoreAllMocks();
});

function renderJoinPage(token = 'test-token') {
  return render(
    <MemoryRouter initialEntries={[`/coder/join/${token}`]}>
      <Routes>
        <Route path="/coder/join/:token" element={<CoderJoinPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('CoderJoinPage', () => {
  it('shows loading state initially', () => {
    globalThis.fetch = vi.fn().mockReturnValue(new Promise(() => {})) as any;
    renderJoinPage();
    expect(screen.getByText(/validating invitation/i)).toBeInTheDocument();
  });

  it('shows team name and form after validation', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        teamName: 'Acme Billing Team',
        email: 'coder@test.com',
        hasPassword: false,
      }),
    }) as any;

    renderJoinPage();

    await waitFor(() => {
      expect(screen.getByText(/join acme billing team/i)).toBeInTheDocument();
    });
    expect(screen.getByDisplayValue('coder@test.com')).toBeInTheDocument();
    expect(screen.getByText(/join team/i)).toBeInTheDocument();
  });

  it('shows error for invalid token', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Invalid or expired invite' }),
    }) as any;

    renderJoinPage('bad-token');

    await waitFor(() => {
      expect(screen.getByText(/invalid invitation/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/invalid or expired invite/i)).toBeInTheDocument();
    expect(screen.getByText(/go to login/i)).toBeInTheDocument();
  });
});
