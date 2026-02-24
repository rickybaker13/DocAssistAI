import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { FocusedAIPanel } from './FocusedAIPanel';
import { vi } from 'vitest';

const mockFetch = vi.fn();
global.fetch = mockFetch;

const mockSection = {
  id: 'sec-1',
  section_name: 'Assessment',
  content: 'Patient with acute neurological deficits.',
};

const focusedResult = {
  analysis: 'Deep analysis here.',
  citations: [{ guideline: 'AHA/ASA', year: '2023', recommendation: 'Determine stroke type.' }],
  suggestions: ['Document stroke type (ischemic vs hemorrhagic)'],
  confidence_breakdown: 'Well supported.',
};

describe('FocusedAIPanel', () => {
  const onClose = vi.fn();
  const onApplySuggestion = vi.fn();

  beforeEach(() => {
    mockFetch.mockReset();
    onClose.mockReset();
    onApplySuggestion.mockReset();
  });

  it('renders analysis and suggestions after loading', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => focusedResult,
    });

    render(
      <FocusedAIPanel
        section={mockSection}
        transcript="Patient has neurological deficits."
        noteType="progress_note"
        verbosity="standard"
        onClose={onClose}
        onApplySuggestion={onApplySuggestion}
      />
    );

    await waitFor(() => expect(screen.getByText('Deep analysis here.')).toBeInTheDocument());
    expect(screen.getByText('Document stroke type (ischemic vs hemorrhagic)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add to note/i })).toBeInTheDocument();
  });

  it('shows loading overlay when Add to note is clicked', async () => {
    // First fetch: focused analysis
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => focusedResult });
    // Second fetch: resolve-suggestion (pending — stays in loading)
    mockFetch.mockImplementationOnce(() => new Promise(() => {}));

    render(
      <FocusedAIPanel
        section={mockSection}
        transcript="Patient has neurological deficits."
        noteType="progress_note"
        verbosity="standard"
        onClose={onClose}
        onApplySuggestion={onApplySuggestion}
      />
    );

    await waitFor(() => screen.getByRole('button', { name: /add to note/i }));
    fireEvent.click(screen.getByRole('button', { name: /add to note/i }));

    expect(screen.getByText(/preparing note text/i)).toBeInTheDocument();
  });

  it('shows clarify overlay with question and options when ready=false', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => focusedResult });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ready: false,
        question: 'What type of stroke?',
        options: ['Ischemic', 'Hemorrhagic', 'Embolic'],
      }),
    });

    render(
      <FocusedAIPanel
        section={mockSection}
        transcript="Patient has neuro deficits."
        noteType="progress_note"
        verbosity="standard"
        onClose={onClose}
        onApplySuggestion={onApplySuggestion}
      />
    );

    await waitFor(() => screen.getByRole('button', { name: /add to note/i }));
    fireEvent.click(screen.getByRole('button', { name: /add to note/i }));

    await waitFor(() => expect(screen.getByText('What type of stroke?')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Ischemic' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Hemorrhagic' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Embolic' })).toBeInTheDocument();
    // "Other…" is always appended by the frontend
    expect(screen.getByRole('button', { name: /other/i })).toBeInTheDocument();
  });

  it('shows preview overlay when ready=true', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => focusedResult });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ready: true, noteText: 'Ischemic stroke, left MCA territory.' }),
    });

    render(
      <FocusedAIPanel
        section={mockSection}
        transcript="Ischemic stroke left MCA."
        noteType="progress_note"
        verbosity="standard"
        onClose={onClose}
        onApplySuggestion={onApplySuggestion}
      />
    );

    await waitFor(() => screen.getByRole('button', { name: /add to note/i }));
    fireEvent.click(screen.getByRole('button', { name: /add to note/i }));

    await waitFor(() =>
      expect(screen.getByText('Ischemic stroke, left MCA territory.')).toBeInTheDocument()
    );
    expect(screen.getByRole('button', { name: /confirm/i })).toBeInTheDocument();
  });

  it('calls onApplySuggestion with note text on confirm', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => focusedResult });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ready: true, noteText: 'Ischemic stroke, left MCA territory.' }),
    });

    render(
      <FocusedAIPanel
        section={mockSection}
        transcript="Ischemic stroke left MCA."
        noteType="progress_note"
        verbosity="standard"
        onClose={onClose}
        onApplySuggestion={onApplySuggestion}
      />
    );

    await waitFor(() => screen.getByRole('button', { name: /add to note/i }));
    fireEvent.click(screen.getByRole('button', { name: /add to note/i }));
    await waitFor(() => screen.getByRole('button', { name: /confirm/i }));
    fireEvent.click(screen.getByRole('button', { name: /confirm/i }));

    expect(onApplySuggestion).toHaveBeenCalledWith('sec-1', 'Ischemic stroke, left MCA territory.');
  });

  it('dismisses overlay on cancel', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => focusedResult });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ready: false,
        question: 'What type of stroke?',
        options: ['Ischemic', 'Hemorrhagic', 'Embolic'],
      }),
    });

    render(
      <FocusedAIPanel
        section={mockSection}
        transcript="x"
        noteType="progress_note"
        verbosity="standard"
        onClose={onClose}
        onApplySuggestion={onApplySuggestion}
      />
    );

    await waitFor(() => screen.getByRole('button', { name: /add to note/i }));
    fireEvent.click(screen.getByRole('button', { name: /add to note/i }));
    await waitFor(() => screen.getByText('What type of stroke?'));
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

    expect(screen.queryByText('What type of stroke?')).not.toBeInTheDocument();
  });

  it('clicking Other… reveals free-text input', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => focusedResult });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ready: false,
        question: 'What artery was involved?',
        options: ['Left MCA', 'Right MCA', 'Basilar artery'],
      }),
    });

    render(
      <FocusedAIPanel
        section={mockSection}
        transcript="Stroke patient."
        noteType="progress_note"
        verbosity="standard"
        onClose={onClose}
        onApplySuggestion={onApplySuggestion}
      />
    );

    await waitFor(() => screen.getByRole('button', { name: /add to note/i }));
    fireEvent.click(screen.getByRole('button', { name: /add to note/i }));
    await waitFor(() => screen.getByRole('button', { name: /other/i }));
    fireEvent.click(screen.getByRole('button', { name: /other/i }));

    expect(screen.getByRole('textbox')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /submit/i })).toBeInTheDocument();
  });

  it('submitting free-text calls handleOptionSelected with typed value', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => focusedResult });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ready: false,
        question: 'What artery was involved?',
        options: ['Left MCA', 'Right MCA', 'Basilar artery'],
      }),
    });
    // Third fetch: ghost-write after free-text submission
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ghostWritten: 'Right PCA territory infarct.' }),
    });

    render(
      <FocusedAIPanel
        section={mockSection}
        transcript="Stroke patient."
        noteType="progress_note"
        verbosity="standard"
        onClose={onClose}
        onApplySuggestion={onApplySuggestion}
      />
    );

    await waitFor(() => screen.getByRole('button', { name: /add to note/i }));
    fireEvent.click(screen.getByRole('button', { name: /add to note/i }));
    await waitFor(() => screen.getByRole('button', { name: /other/i }));
    fireEvent.click(screen.getByRole('button', { name: /other/i }));

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Right PCA' } });
    fireEvent.click(screen.getByRole('button', { name: /submit/i }));

    await waitFor(() =>
      expect(screen.getByText('Right PCA territory infarct.')).toBeInTheDocument()
    );
  });

  it('back link in free-text view returns to pill view', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => focusedResult });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ready: false,
        question: 'What artery was involved?',
        options: ['Left MCA', 'Right MCA', 'Basilar artery'],
      }),
    });

    render(
      <FocusedAIPanel
        section={mockSection}
        transcript="Stroke patient."
        noteType="progress_note"
        verbosity="standard"
        onClose={onClose}
        onApplySuggestion={onApplySuggestion}
      />
    );

    await waitFor(() => screen.getByRole('button', { name: /add to note/i }));
    fireEvent.click(screen.getByRole('button', { name: /add to note/i }));
    await waitFor(() => screen.getByRole('button', { name: /other/i }));
    fireEvent.click(screen.getByRole('button', { name: /other/i }));

    // In free-text view, pills are hidden
    expect(screen.queryByRole('button', { name: 'Left MCA' })).not.toBeInTheDocument();

    // Click back
    fireEvent.click(screen.getByRole('button', { name: /back/i }));

    // Pills are visible again
    expect(screen.getByRole('button', { name: 'Left MCA' })).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('does not call onClose after confirming a suggestion', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => focusedResult });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ready: true, noteText: 'Ischemic stroke, left MCA territory.' }),
    });

    render(
      <FocusedAIPanel
        section={mockSection}
        transcript="Ischemic stroke left MCA."
        noteType="progress_note"
        verbosity="standard"
        onClose={onClose}
        onApplySuggestion={onApplySuggestion}
      />
    );

    await waitFor(() => screen.getByRole('button', { name: /add to note/i }));
    fireEvent.click(screen.getAllByRole('button', { name: /add to note/i })[0]);
    await waitFor(() => screen.getByRole('button', { name: /confirm/i }));
    fireEvent.click(screen.getByRole('button', { name: /confirm/i }));

    expect(onClose).not.toHaveBeenCalled();
    expect(onApplySuggestion).toHaveBeenCalledWith('sec-1', 'Ischemic stroke, left MCA territory.');
  });

  it('Enter key submits free-text input', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => focusedResult });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ready: false,
        question: 'What artery was involved?',
        options: ['Left MCA', 'Right MCA', 'Basilar artery'],
      }),
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ghostWritten: 'Right PCA territory infarct.' }),
    });

    render(
      <FocusedAIPanel
        section={mockSection}
        transcript="Stroke patient."
        noteType="progress_note"
        verbosity="standard"
        onClose={onClose}
        onApplySuggestion={onApplySuggestion}
      />
    );

    await waitFor(() => screen.getByRole('button', { name: /add to note/i }));
    fireEvent.click(screen.getByRole('button', { name: /add to note/i }));
    await waitFor(() => screen.getByRole('button', { name: /other/i }));
    fireEvent.click(screen.getByRole('button', { name: /other/i }));

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'Right PCA' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

    await waitFor(() =>
      expect(screen.getByText('Right PCA territory infarct.')).toBeInTheDocument()
    );
  });
});
