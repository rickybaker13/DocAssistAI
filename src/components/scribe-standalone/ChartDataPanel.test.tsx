import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ChartDataPanel } from './ChartDataPanel';

describe('ChartDataPanel', () => {
  const defaultProps = {
    noteType: 'progress_note',
    verbosity: 'standard',
    onGraphResult: vi.fn(),
    onApplyText: vi.fn(),
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders collapsed by default', () => {
    render(<ChartDataPanel {...defaultProps} />);
    expect(screen.getByText('Chart Data')).toBeInTheDocument();
    // Textarea should not be visible when collapsed
    expect(screen.queryByPlaceholderText(/paste/i)).not.toBeInTheDocument();
  });

  it('expands on header click', () => {
    render(<ChartDataPanel {...defaultProps} />);
    fireEvent.click(screen.getByText('Chart Data'));
    expect(screen.getByPlaceholderText(/paste numerical data/i)).toBeInTheDocument();
  });

  it('shows "Graph Values" mode by default with correct button text', () => {
    render(<ChartDataPanel {...defaultProps} />);
    fireEvent.click(screen.getByText('Chart Data'));
    expect(screen.getByText('Generate Graph')).toBeInTheDocument();
  });

  it('switches to "Add to Note" mode', () => {
    render(<ChartDataPanel {...defaultProps} />);
    fireEvent.click(screen.getByText('Chart Data'));
    fireEvent.click(screen.getByText('Add to Note'));
    expect(screen.getByText('Process & Add to Note')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/paste chart data/i)).toBeInTheDocument();
  });

  it('disables submit button when textarea is empty', () => {
    render(<ChartDataPanel {...defaultProps} />);
    fireEvent.click(screen.getByText('Chart Data'));
    const submitBtn = screen.getByText('Generate Graph').closest('button')!;
    expect(submitBtn).toBeDisabled();
  });

  it('enables submit button when textarea has content', () => {
    render(<ChartDataPanel {...defaultProps} />);
    fireEvent.click(screen.getByText('Chart Data'));
    fireEvent.change(screen.getByPlaceholderText(/paste numerical data/i), {
      target: { value: 'WBC: 12, 11, 9' },
    });
    const submitBtn = screen.getByText('Generate Graph').closest('button')!;
    expect(submitBtn).not.toBeDisabled();
  });
});
