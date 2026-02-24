import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ScribeChatDrawer } from './ScribeChatDrawer';
import { vi } from 'vitest';

const mockSections = [
  { id: 's1', section_name: 'HPI', content: 'Patient has chest pain.', confidence: 0.9, display_order: 0 },
  { id: 's2', section_name: 'Plan', content: 'Will obtain ECG.', confidence: 0.8, display_order: 1 },
];

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('ScribeChatDrawer', () => {
  const onInsert = vi.fn();

  beforeEach(() => {
    mockFetch.mockReset();
    onInsert.mockReset();
  });

  it('renders a floating chat button when closed', () => {
    render(<ScribeChatDrawer sections={mockSections} noteType="progress_note" verbosity="standard" onInsert={onInsert} />);
    expect(screen.getByRole('button', { name: /chat/i })).toBeInTheDocument();
  });

  it('opens the drawer when chat button is clicked', () => {
    render(<ScribeChatDrawer sections={mockSections} noteType="progress_note" verbosity="standard" onInsert={onInsert} />);
    fireEvent.click(screen.getByRole('button', { name: /chat/i }));
    expect(screen.getByPlaceholderText(/ask a clinical question/i)).toBeInTheDocument();
  });

  it('sends message and shows AI response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, cited: false, data: { content: 'MRI brain with DWI is indicated.' } }),
    });

    render(<ScribeChatDrawer sections={mockSections} noteType="progress_note" verbosity="standard" onInsert={onInsert} />);
    fireEvent.click(screen.getByRole('button', { name: /chat/i }));
    const input = screen.getByPlaceholderText(/ask a clinical question/i);
    fireEvent.change(input, { target: { value: 'What MRI should I order?' } });
    fireEvent.submit(input.closest('form')!);

    await waitFor(() => expect(screen.getByText('MRI brain with DWI is indicated.')).toBeInTheDocument());
  });

  it('shows Add to Note button after AI responds', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, cited: false, data: { content: 'Some AI answer.' } }),
    });

    render(<ScribeChatDrawer sections={mockSections} noteType="progress_note" verbosity="standard" onInsert={onInsert} />);
    fireEvent.click(screen.getByRole('button', { name: /chat/i }));
    const input = screen.getByPlaceholderText(/ask a clinical question/i);
    fireEvent.change(input, { target: { value: 'Question' } });
    fireEvent.submit(input.closest('form')!);

    await waitFor(() => screen.getByText('Some AI answer.'));
    expect(screen.getByRole('button', { name: /add to note/i })).toBeInTheDocument();
  });
});
