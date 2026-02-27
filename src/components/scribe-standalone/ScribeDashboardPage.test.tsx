import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ScribeDashboardPage } from './ScribeDashboardPage';
import { useScribeNoteStore } from '../../stores/scribeNoteStore';
import { vi } from 'vitest';

describe('ScribeDashboardPage', () => {
  afterEach(() => {
    vi.clearAllMocks();
    useScribeNoteStore.getState().reset();
  });

  it('shows empty state when no active note', () => {
    render(<MemoryRouter><ScribeDashboardPage /></MemoryRouter>);
    expect(screen.getByText(/no notes yet/i)).toBeInTheDocument();
  });

  it('shows current note when one is in progress', () => {
    useScribeNoteStore.setState({
      noteId: 'note-1',
      noteType: 'progress_note',
      patientLabel: 'Bed 3',
      verbosity: 'standard',
      transcript: '',
      sections: [],
      status: 'draft',
    });
    render(<MemoryRouter><ScribeDashboardPage /></MemoryRouter>);
    expect(screen.getByText('Bed 3')).toBeInTheDocument();
    expect(screen.getByText('draft')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /open/i })).toBeInTheDocument();
  });

  it('discards the active note on Discard click', () => {
    useScribeNoteStore.setState({
      noteId: 'note-1',
      noteType: 'progress_note',
      patientLabel: 'Bed 3',
      verbosity: 'standard',
      transcript: '',
      sections: [],
      status: 'draft',
    });
    render(<MemoryRouter><ScribeDashboardPage /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: /discard/i }));
    expect(screen.getByText(/no notes yet/i)).toBeInTheDocument();
    expect(useScribeNoteStore.getState().noteId).toBeNull();
  });
});
