import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CoderDashboard } from './CoderDashboard';
import { useCoderStore } from '../../stores/coderStore';
import { vi, describe, it, expect, beforeEach } from 'vitest';

beforeEach(() => {
  useCoderStore.getState().reset();
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => [],
  }) as any;
});

function renderDashboard() {
  return render(
    <MemoryRouter>
      <CoderDashboard />
    </MemoryRouter>,
  );
}

describe('CoderDashboard', () => {
  it('renders note input form', () => {
    renderDashboard();
    expect(screen.getByPlaceholderText(/paste/i)).toBeInTheDocument();
    expect(screen.getByText(/generate codes/i)).toBeInTheDocument();
  });

  it('renders patient info fields', () => {
    renderDashboard();
    expect(screen.getByPlaceholderText('Last, First')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Provider name')).toBeInTheDocument();
  });

  it('disables generate button when required fields are empty', () => {
    renderDashboard();
    const btn = screen.getByText(/generate codes/i);
    expect(btn).toBeDisabled();
  });

  it('shows results panel after extraction', () => {
    useCoderStore.setState({
      lastResult: {
        icd10_codes: [
          { code: 'E11.9', description: 'T2DM', confidence: 0.9 },
        ],
        cpt_codes: [],
        em_level: null,
        missing_documentation: [],
        disclaimer: 'Test disclaimer',
      },
    });
    renderDashboard();
    expect(screen.getByText('E11.9')).toBeInTheDocument();
    expect(screen.getByText(/T2DM/)).toBeInTheDocument();
    expect(screen.getByText(/Test disclaimer/)).toBeInTheDocument();
  });

  it('shows loading state when extracting', () => {
    useCoderStore.setState({ extracting: true });
    renderDashboard();
    expect(screen.getByText(/analyzing note/i)).toBeInTheDocument();
  });

  it('shows error state', () => {
    useCoderStore.setState({ extractError: 'Something went wrong' });
    renderDashboard();
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('renders weekly batch table section', () => {
    renderDashboard();
    expect(screen.getByText(/recent sessions/i)).toBeInTheDocument();
    expect(screen.getByText(/export this week/i)).toBeInTheDocument();
  });

  it('shows empty table message when no sessions', async () => {
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByText(/no sessions yet/i)).toBeInTheDocument();
    });
  });

  it('displays sessions in the table', async () => {
    const sessionData = [
      {
        id: '1',
        coder_user_id: 'u1',
        team_id: 't1',
        patient_name: 'Doe, John',
        mrn: '12345',
        date_of_service: '2026-03-28',
        provider_name: 'Dr. Smith',
        facility: 'Main Hospital',
        note_type: 'Inpatient',
        icd10_codes: [
          { code: 'E11.9', description: 'T2DM', confidence: 0.9 },
          { code: 'I10', description: 'HTN', confidence: 0.88 },
          { code: 'J44.1', description: 'COPD', confidence: 0.75 },
        ],
        cpt_codes: [
          { code: '99223', description: 'Initial hosp care', confidence: 0.88 },
        ],
        em_level: null,
        missing_documentation: [],
        coder_status: 'reviewed',
        batch_week: '2026-W13',
        created_at: '2026-03-28T12:00:00Z',
      },
    ];
    // Mock fetch to return session data (fetchSessions is called on mount)
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => sessionData,
    }) as any;
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByText('Doe, John')).toBeInTheDocument();
    });
    expect(screen.getByText('Dr. Smith')).toBeInTheDocument();
    expect(screen.getByText('Reviewed')).toBeInTheDocument();
  });

  it('shows missing documentation warnings', () => {
    useCoderStore.setState({
      lastResult: {
        icd10_codes: [],
        cpt_codes: [],
        em_level: null,
        missing_documentation: ['Laterality not specified for fracture'],
        disclaimer: 'AI generated',
      },
    });
    renderDashboard();
    expect(
      screen.getByText('Laterality not specified for fracture'),
    ).toBeInTheDocument();
  });
});
