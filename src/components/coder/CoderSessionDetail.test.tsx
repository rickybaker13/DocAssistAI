import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { CoderSessionDetail } from './CoderSessionDetail';
import { vi, describe, it, expect, beforeEach } from 'vitest';

const MOCK_SESSION = {
  id: 'test-id',
  coder_user_id: 'u1',
  team_id: 't1',
  patient_name: 'Smith, Jane',
  mrn: '98765',
  date_of_service: '2026-03-25',
  provider_name: 'Dr. Williams',
  facility: 'City Hospital',
  note_type: 'Inpatient',
  icd10_codes: [
    { code: 'E11.9', description: 'Type 2 diabetes mellitus', confidence: 0.95 },
    { code: 'I10', description: 'Essential hypertension', confidence: 0.88 },
    { code: 'N18.3', description: 'CKD stage 3', confidence: 0.65 },
  ],
  cpt_codes: [
    { code: '99223', description: 'Initial hospital care', confidence: 0.9 },
  ],
  em_level: { suggested: '99223', mdm_complexity: 'High', reasoning: 'Complex MDM' },
  missing_documentation: ['Laterality not specified'],
  coder_status: 'reviewed' as const,
  batch_week: '2026-W13',
  created_at: '2026-03-25T10:00:00Z',
};

function renderDetail(id = 'test-id') {
  return render(
    <MemoryRouter initialEntries={[`/coder/session/${id}`]}>
      <Routes>
        <Route path="/coder/session/:id" element={<CoderSessionDetail />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('CoderSessionDetail', () => {
  it('shows loading state initially', () => {
    globalThis.fetch = vi.fn().mockReturnValue(new Promise(() => {})) as any;
    renderDetail();
    expect(screen.getByTestId('loading')).toBeInTheDocument();
  });

  it('renders session data after fetch', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => MOCK_SESSION,
    }) as any;

    renderDetail();

    await waitFor(() => {
      expect(screen.getByText('Smith, Jane')).toBeInTheDocument();
    });
    expect(screen.getByText('Dr. Williams')).toBeInTheDocument();
    expect(screen.getByText('City Hospital')).toBeInTheDocument();
    expect(screen.getByText('Inpatient')).toBeInTheDocument();
    expect(screen.getByText(/98765/)).toBeInTheDocument();
  });

  it('shows all ICD-10 codes', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => MOCK_SESSION,
    }) as any;

    renderDetail();

    await waitFor(() => {
      expect(screen.getByText('E11.9')).toBeInTheDocument();
    });
    expect(screen.getByText('I10')).toBeInTheDocument();
    expect(screen.getByText('N18.3')).toBeInTheDocument();
    expect(screen.getByText('Type 2 diabetes mellitus')).toBeInTheDocument();
    expect(screen.getByText('Essential hypertension')).toBeInTheDocument();
    expect(screen.getByText('CKD stage 3')).toBeInTheDocument();
  });

  it('status badge matches coder_status', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => MOCK_SESSION,
    }) as any;

    renderDetail();

    await waitFor(() => {
      const badge = screen.getByTestId('status-badge');
      expect(badge).toHaveTextContent('Reviewed');
      expect(badge.className).toContain('bg-teal-900');
    });
  });

  it('shows flagged status correctly', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ...MOCK_SESSION, coder_status: 'flagged' }),
    }) as any;

    renderDetail();

    await waitFor(() => {
      const badge = screen.getByTestId('status-badge');
      expect(badge).toHaveTextContent('Flagged');
      expect(badge.className).toContain('bg-red-900');
    });
  });

  it('shows error when fetch fails', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({}),
    }) as any;

    renderDetail();

    await waitFor(() => {
      expect(screen.getByText(/failed to load session/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/back to dashboard/i)).toBeInTheDocument();
  });
});
