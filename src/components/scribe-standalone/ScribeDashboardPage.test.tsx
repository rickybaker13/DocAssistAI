import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ScribeDashboardPage } from './ScribeDashboardPage';
import { vi } from 'vitest';

const mockNotes = [
  { id: 'n1', note_type: 'progress_note', patient_label: 'Bed 3', status: 'draft', created_at: '2026-02-23T09:00:00Z', updated_at: '2026-02-23T09:00:00Z' },
  { id: 'n2', note_type: 'h_and_p', patient_label: null, status: 'finalized', created_at: '2026-02-22T08:00:00Z', updated_at: '2026-02-22T08:00:00Z' },
  { id: 'n3', note_type: 'consult_note', patient_label: 'Dr. Smith consult', status: 'draft', created_at: '2026-02-21T07:00:00Z', updated_at: '2026-02-21T07:00:00Z' },
];

const mockFetch = vi.fn();
global.fetch = mockFetch as unknown as typeof fetch;

describe('ScribeDashboardPage', () => {
  beforeEach(() => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ notes: mockNotes }) });
  });
  afterEach(() => vi.clearAllMocks());

  it('renders note cards after loading', async () => {
    render(<MemoryRouter><ScribeDashboardPage /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText('Bed 3')).toBeInTheDocument());
    expect(screen.getByText('Dr. Smith consult')).toBeInTheDocument();
  });

  it('shows empty state when no notes', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ notes: [] }) });
    render(<MemoryRouter><ScribeDashboardPage /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText(/no notes yet/i)).toBeInTheDocument());
  });

  it('filters notes by search text', async () => {
    render(<MemoryRouter><ScribeDashboardPage /></MemoryRouter>);
    await waitFor(() => screen.getByText('Bed 3'));
    fireEvent.change(screen.getByPlaceholderText(/search/i), { target: { value: 'consult' } });
    expect(screen.queryByText('Bed 3')).not.toBeInTheDocument();
    expect(screen.getByText('Dr. Smith consult')).toBeInTheDocument();
  });

  it('filters by status chip — Finalized shows only finalized notes', async () => {
    render(<MemoryRouter><ScribeDashboardPage /></MemoryRouter>);
    await waitFor(() => screen.getByText('Bed 3'));
    fireEvent.click(screen.getByRole('button', { name: /^finalized$/i }));
    await waitFor(() => expect(screen.queryByText('Bed 3')).not.toBeInTheDocument());
  });

  it('deletes a note on confirm', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ notes: mockNotes }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) });

    render(<MemoryRouter><ScribeDashboardPage /></MemoryRouter>);
    await waitFor(() => screen.getByText('Bed 3'));
    fireEvent.click(screen.getAllByRole('button', { name: /delete note/i })[0]);
    fireEvent.click(screen.getByRole('button', { name: /^delete$/i }));
    await waitFor(() => expect(screen.queryByText('Bed 3')).not.toBeInTheDocument());
  });
});
