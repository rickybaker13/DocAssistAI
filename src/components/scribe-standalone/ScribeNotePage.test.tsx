import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ScribeNotePage } from './ScribeNotePage';
import { vi } from 'vitest';

const mockNote = { id: 'note-1', note_type: 'progress_note', patient_label: 'Bed 5', status: 'draft', transcript: 'Patient came in...' };
const mockSections = [
  { id: 's1', section_name: 'HPI', content: 'Patient presents with chest pain.', confidence: 0.9, display_order: 0 },
  { id: 's2', section_name: 'Assessment', content: 'Likely ACS.', confidence: 0.5, display_order: 1 },
];

describe('ScribeNotePage', () => {
  beforeEach(() => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ note: mockNote, sections: mockSections }),
    });
  });
  afterEach(() => vi.clearAllMocks());

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
    expect(screen.getByText('Assessment')).toBeInTheDocument();
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
