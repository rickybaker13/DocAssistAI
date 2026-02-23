import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ScribeRecordPage } from './ScribeRecordPage';
import { vi } from 'vitest';

vi.mock('../scribe/AudioRecorder', () => ({
  AudioRecorder: ({ onTranscript }: any) => (
    <button onClick={() => onTranscript('Test transcript')}>Mock Record</button>
  ),
}));

describe('ScribeRecordPage', () => {
  const renderWithRoute = (id = 'note-123') =>
    render(
      <MemoryRouter initialEntries={[`/scribe/note/${id}/record`]}>
        <Routes>
          <Route path="/scribe/note/:id/record" element={<ScribeRecordPage />} />
          <Route path="/scribe/note/:id" element={<div>Note screen</div>} />
        </Routes>
      </MemoryRouter>
    );

  it('renders the record button', () => {
    renderWithRoute();
    expect(screen.getByText('Mock Record')).toBeInTheDocument();
  });

  it('shows ready to record header', () => {
    renderWithRoute();
    expect(screen.getByText(/ready to record/i)).toBeInTheDocument();
  });
});
