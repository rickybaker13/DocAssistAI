import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ScribeDashboardPage } from './ScribeDashboardPage';
import { useScribeNoteStore } from '../../stores/scribeNoteStore';
import { vi } from 'vitest';

// Mock fetch to return empty notes list by default
beforeEach(() => {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ notes: [] }),
  }) as any;
});

describe('ScribeDashboardPage', () => {
  afterEach(() => {
    vi.clearAllMocks();
    useScribeNoteStore.getState().reset();
  });

  it('shows empty state when no active note', async () => {
    render(<MemoryRouter><ScribeDashboardPage /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByText(/no notes yet/i)).toBeInTheDocument();
    });
  });

  it('shows encounter when one is ready', async () => {
    useScribeNoteStore.setState({
      encounters: [{
        noteId: 'note-1',
        noteType: 'progress_note',
        patientLabel: 'Bed 3',
        verbosity: 'standard',
        transcript: 'test transcript',
        sections: [{ id: 's1', section_name: 'HPI', content: 'test', confidence: 0.9, display_order: 0 }],
        status: 'ready',
        error: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }],
    });
    render(<MemoryRouter><ScribeDashboardPage /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByText('Bed 3')).toBeInTheDocument();
    });
  });

  it('shows saved notes from backend', async () => {
    (globalThis.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({
        notes: [{
          id: 'saved-1',
          note_type: 'progress_note',
          patient_label: 'Room 5',
          verbosity: 'standard',
          status: 'draft',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }],
      }),
    });
    render(<MemoryRouter><ScribeDashboardPage /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByText('Room 5')).toBeInTheDocument();
    });
    expect(screen.getByText('draft')).toBeInTheDocument();
  });

  it('removes encounter on Remove click', async () => {
    useScribeNoteStore.setState({
      encounters: [{
        noteId: 'note-1',
        noteType: 'progress_note',
        patientLabel: 'Bed 3',
        verbosity: 'standard',
        transcript: '',
        sections: [],
        status: 'failed',
        error: 'test error',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }],
    });
    render(<MemoryRouter><ScribeDashboardPage /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByText('Bed 3')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /remove/i }));
    await waitFor(() => {
      expect(screen.getByText(/no notes yet/i)).toBeInTheDocument();
    });
    expect(useScribeNoteStore.getState().encounters).toHaveLength(0);
  });
});
