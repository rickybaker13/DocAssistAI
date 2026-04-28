import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { useScribeAuthStore } from '../../stores/scribeAuthStore';
import { CoderTeamManagement } from './CoderTeamManagement';

const TEAM_RESPONSE = {
  team: {
    id: 'team-1',
    name: 'Acme Coding Team',
    included_notes: 500,
  },
  members: [
    { id: 'm1', name: 'Alice', email: 'alice@acme.com', role: 'coding_manager', status: 'active' },
    { id: 'm2', name: 'Bob', email: 'bob@acme.com', role: 'billing_coder', status: 'pending' },
    { id: 'm3', name: null, email: 'carol@acme.com', role: 'billing_coder', status: 'deactivated' },
  ],
};

const USAGE_RESPONSE = {
  current: { notes_coded: 342, overage_notes: 0, overage_charge_cents: 0 },
  history: [],
};

function mockFetchResponses(overrides?: Record<string, any>) {
  globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
    if (typeof url === 'string' && url.includes('/usage')) {
      return { ok: true, json: async () => overrides?.usage ?? USAGE_RESPONSE };
    }
    if (typeof url === 'string' && url.includes('/teams/')) {
      return { ok: true, json: async () => overrides?.team ?? TEAM_RESPONSE };
    }
    return { ok: true, json: async () => ({}) };
  }) as any;
}

beforeEach(() => {
  vi.restoreAllMocks();
  useScribeAuthStore.setState({
    user: {
      id: 'u1',
      email: 'manager@acme.com',
      name: 'Manager',
      specialty: null,
      is_admin: false,
      billing_codes_enabled: true,
      user_role: 'coding_manager',
      coding_team_id: 'team-1',
    },
  });
});

describe('CoderTeamManagement', () => {
  it('shows loading state', () => {
    // Never resolve fetch so we stay in loading
    globalThis.fetch = vi.fn().mockReturnValue(new Promise(() => {})) as any;
    render(<CoderTeamManagement />);
    expect(screen.getByText(/loading team data/i)).toBeInTheDocument();
  });

  it('renders team name and members after fetch', async () => {
    mockFetchResponses();
    render(<CoderTeamManagement />);

    await waitFor(() => {
      expect(screen.getByText('Acme Coding Team')).toBeInTheDocument();
    });

    expect(screen.getByText('alice@acme.com')).toBeInTheDocument();
    expect(screen.getByText('bob@acme.com')).toBeInTheDocument();
    expect(screen.getByText('carol@acme.com')).toBeInTheDocument();

    // Status badges
    expect(screen.getByText('active')).toBeInTheDocument();
    expect(screen.getByText('pending')).toBeInTheDocument();
    expect(screen.getByText('deactivated')).toBeInTheDocument();
  });

  it('shows usage bar', async () => {
    mockFetchResponses();
    render(<CoderTeamManagement />);

    await waitFor(() => {
      expect(screen.getByText(/342 \/ 500 notes this month/)).toBeInTheDocument();
    });
  });

  it('shows overage warning when over limit', async () => {
    mockFetchResponses({
      usage: {
        current: { notes_coded: 642, overage_notes: 142, overage_charge_cents: 1420 },
        history: [],
      },
    });
    render(<CoderTeamManagement />);

    await waitFor(() => {
      expect(screen.getByText(/142 overage notes/)).toBeInTheDocument();
      expect(screen.getByText(/\$14\.20/)).toBeInTheDocument();
    });
  });

  it('invite form renders and submits', async () => {
    mockFetchResponses();
    render(<CoderTeamManagement />);

    await waitFor(() => {
      expect(screen.getByText('Invite Coder')).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText('coder@example.com');
    const button = screen.getByText('Send Invite');
    expect(input).toBeInTheDocument();
    expect(button).toBeInTheDocument();

    // Fill and submit
    fireEvent.change(input, { target: { value: 'new@acme.com' } });
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText(/invitation sent to new@acme.com/i)).toBeInTheDocument();
    });
  });

  it('shows no team message when coding_team_id is null', () => {
    useScribeAuthStore.setState({
      user: {
        id: 'u1',
        email: 'solo@acme.com',
        name: 'Solo',
        specialty: null,
        is_admin: false,
        billing_codes_enabled: true,
        user_role: 'coding_manager',
        coding_team_id: null,
      },
    });
    globalThis.fetch = vi.fn() as any;
    render(<CoderTeamManagement />);
    expect(screen.getByText(/no team assigned/i)).toBeInTheDocument();
  });
});
