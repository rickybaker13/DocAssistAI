import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GraphResultPanel } from './GraphResultPanel';

describe('GraphResultPanel', () => {
  const sampleSvg = '<svg viewBox="0 0 600 400" xmlns="http://www.w3.org/2000/svg"><rect width="600" height="400" fill="white"/><text x="300" y="200">Test Chart</text></svg>';

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders nothing when svgMarkup is null', () => {
    const { container } = render(<GraphResultPanel svgMarkup={null} onClear={vi.fn()} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders SVG when svgMarkup is provided', () => {
    render(<GraphResultPanel svgMarkup={sampleSvg} onClear={vi.fn()} />);
    expect(screen.getByText('Chart')).toBeInTheDocument();
    expect(screen.getByText('Copy as Image')).toBeInTheDocument();
    expect(screen.getByText('Clear')).toBeInTheDocument();
  });

  it('calls onClear when clear button is clicked', () => {
    const onClear = vi.fn();
    render(<GraphResultPanel svgMarkup={sampleSvg} onClear={onClear} />);
    fireEvent.click(screen.getByText('Clear'));
    expect(onClear).toHaveBeenCalledOnce();
  });

  it('collapses and expands on header click', () => {
    render(<GraphResultPanel svgMarkup={sampleSvg} onClear={vi.fn()} />);
    // Should be expanded by default
    expect(screen.getByText('Copy as Image')).toBeInTheDocument();

    // Collapse
    fireEvent.click(screen.getByText('Chart'));
    expect(screen.queryByText('Copy as Image')).not.toBeInTheDocument();

    // Expand again
    fireEvent.click(screen.getByText('Chart'));
    expect(screen.getByText('Copy as Image')).toBeInTheDocument();
  });

  it('sanitizes SVG markup (strips script tags)', () => {
    const maliciousSvg = '<svg><script>alert("xss")</script><text>Safe</text></svg>';
    const { container } = render(<GraphResultPanel svgMarkup={maliciousSvg} onClear={vi.fn()} />);
    expect(container.innerHTML).not.toContain('<script>');
    expect(container.innerHTML).toContain('Safe');
  });

  it('renders download PNG button', () => {
    render(<GraphResultPanel svgMarkup={sampleSvg} onClear={vi.fn()} />);
    expect(screen.getByText('Download PNG')).toBeInTheDocument();
  });

  it('shows EHR fallback hint text', () => {
    render(<GraphResultPanel svgMarkup={sampleSvg} onClear={vi.fn()} />);
    expect(screen.getByText(/Insert Image/)).toBeInTheDocument();
  });
});
