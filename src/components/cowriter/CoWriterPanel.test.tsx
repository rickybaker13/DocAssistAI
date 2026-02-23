import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CoWriterPanel } from './CoWriterPanel';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

const mockDocumentResponse = {
  document: {
    noteType: 'Progress Note',
    sections: [
      { name: 'Subjective', content: 'Patient reports shortness of breath.', sources: ['Obs/123'] },
      { name: 'Assessment', content: 'Acute hypoxic respiratory failure.', sources: [] },
    ],
    generatedAt: new Date().toISOString(),
  },
  noteType: 'Progress Note',
};

describe('CoWriterPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockDocumentResponse,
    });
  });

  it('renders note type selector and generate button', () => {
    render(<CoWriterPanel />);
    expect(screen.getByRole('combobox')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /generate note/i })).toBeInTheDocument();
  });

  it('renders optional context textarea', () => {
    render(<CoWriterPanel />);
    expect(screen.getByPlaceholderText(/optional/i)).toBeInTheDocument();
  });

  it('shows generated sections after clicking Generate', async () => {
    render(<CoWriterPanel />);
    fireEvent.click(screen.getByRole('button', { name: /generate note/i }));
    await waitFor(() => {
      expect(screen.getByText(/subjective/i)).toBeInTheDocument();
      expect(screen.getByText(/patient reports shortness of breath/i)).toBeInTheDocument();
    });
  });

  it('shows Copy All button after generation', async () => {
    render(<CoWriterPanel />);
    fireEvent.click(screen.getByRole('button', { name: /generate note/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /copy all/i })).toBeInTheDocument();
    });
  });

  it('allows editing individual sections', async () => {
    render(<CoWriterPanel />);
    fireEvent.click(screen.getByRole('button', { name: /generate note/i }));
    await waitFor(() => {
      expect(screen.getByText(/patient reports shortness of breath/i)).toBeInTheDocument();
    });
    const textareas = screen.getAllByRole('textbox');
    // First textarea is the optional context field, subsequent are section editors
    const sectionTextarea = textareas[1]; // first section textarea
    fireEvent.change(sectionTextarea, { target: { value: 'Edited content' } });
    expect(sectionTextarea).toHaveValue('Edited content');
  });
});
