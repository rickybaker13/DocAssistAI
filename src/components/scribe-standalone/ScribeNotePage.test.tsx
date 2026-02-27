import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ScribeNotePage } from './ScribeNotePage';
import { useScribeNoteStore } from '../../stores/scribeNoteStore';
import { vi } from 'vitest';

const mockSections = [
  { id: 's1', section_name: 'HPI', content: 'Patient presents with chest pain.', confidence: 0.9, display_order: 0 },
  { id: 's2', section_name: 'Assessment', content: 'Likely ACS.', confidence: 0.5, display_order: 1 },
];

describe('ScribeNotePage', () => {
  beforeEach(() => {
    // Seed the Zustand store with note data (client-side, no server fetch)
    useScribeNoteStore.setState({
      noteId: 'note-1',
      noteType: 'progress_note',
      patientLabel: 'Bed 5',
      verbosity: 'standard',
      transcript: 'Patient came in...',
      sections: mockSections,
      status: 'draft',
    });

    // Mock fetch for the section library template list (non-critical)
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ templates: [] }),
    });
  });
  afterEach(() => {
    vi.clearAllMocks();
    useScribeNoteStore.getState().reset();
  });

  const renderPage = () =>
    render(
      <MemoryRouter initialEntries={['/scribe/note/note-1']}>
        <Routes>
          <Route path="/scribe/note/:id" element={<ScribeNotePage />} />
        </Routes>
      </MemoryRouter>
    );

  it('renders section names after loading', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('HPI')).toBeInTheDocument());
    expect(screen.getByText('ASSESSMENT')).toBeInTheDocument();
  });

  it('shows confidence badges', async () => {
    renderPage();
    await waitFor(() => screen.getByText('HPI'));
    expect(screen.getAllByText(/90%/i).length).toBeGreaterThan(0);
  });

  it('has a Copy Note button', async () => {
    renderPage();
    await waitFor(() => screen.getByText('HPI'));
    expect(screen.getByRole('button', { name: /copy note/i })).toBeInTheDocument();
  });

  it('has a Focused AI button on each section', async () => {
    renderPage();
    await waitFor(() => screen.getByText('HPI'));
    const focusedButtons = screen.getAllByRole('button', { name: /focused ai/i });
    expect(focusedButtons.length).toBeGreaterThanOrEqual(1);
  });
});
