import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NoteSectionEditor } from './NoteSectionEditor';

const base = { id: 'sec-1', section_name: 'Assessment', content: '', confidence: null, display_order: 0 };

describe('NoteSectionEditor', () => {
  it('renders section name in header', () => {
    render(<NoteSectionEditor section={base} onChange={vi.fn()} onFocusedAI={vi.fn()} />);
    expect(screen.getByText('ASSESSMENT')).toBeInTheDocument();
  });

  it('renders highlight overlay container', () => {
    const section = { ...base, content: 'Patient has high blood pressure.' };
    render(<NoteSectionEditor section={section} onChange={vi.fn()} onFocusedAI={vi.fn()} />);
    expect(document.querySelector('[data-testid="coding-highlight-overlay"]')).toBeInTheDocument();
  });

  it('shows amber badge in header when vague terms detected', () => {
    const section = { ...base, content: 'Assessment: CHF.' };
    render(<NoteSectionEditor section={section} onChange={vi.fn()} onFocusedAI={vi.fn()} />);
    expect(screen.getByTitle(/ICD-10 coding term/i)).toBeInTheDocument();
  });

  it('opens CodingTermPopover when clicking on a flagged term position', () => {
    const section = { ...base, content: 'Assessment: CHF on lisinopril.' };
    render(<NoteSectionEditor section={section} onChange={vi.fn()} onFocusedAI={vi.fn()} />);

    const textarea = screen.getByRole('textbox');
    // "Assessment: " = 12 chars; CHF starts at index 12
    Object.defineProperty(textarea, 'selectionStart', { get: () => 12, configurable: true });
    fireEvent.click(textarea, { clientX: 150, clientY: 300 });

    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('does NOT open popover when clicking non-flagged position', () => {
    const section = { ...base, content: 'Patient has essential hypertension.' };
    render(<NoteSectionEditor section={section} onChange={vi.fn()} onFocusedAI={vi.fn()} />);

    const textarea = screen.getByRole('textbox');
    Object.defineProperty(textarea, 'selectionStart', { get: () => 0, configurable: true });
    fireEvent.click(textarea, { clientX: 50, clientY: 300 });

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('replaces vague term when popover option selected', () => {
    const onChange = vi.fn();
    const section = { ...base, content: 'Assessment: CHF on lisinopril.' };
    render(<NoteSectionEditor section={section} onChange={onChange} onFocusedAI={vi.fn()} />);

    const textarea = screen.getByRole('textbox');
    Object.defineProperty(textarea, 'selectionStart', { get: () => 12, configurable: true });
    fireEvent.click(textarea, { clientX: 150, clientY: 300 });
    fireEvent.click(screen.getByRole('button', { name: /Acute systolic heart failure/i }));

    expect(onChange).toHaveBeenCalledWith('sec-1', 'Assessment: Acute systolic heart failure on lisinopril.');
  });

  it('closes popover without change when skip is clicked', () => {
    const onChange = vi.fn();
    const section = { ...base, content: 'Assessment: CHF on lisinopril.' };
    render(<NoteSectionEditor section={section} onChange={onChange} onFocusedAI={vi.fn()} />);

    const textarea = screen.getByRole('textbox');
    Object.defineProperty(textarea, 'selectionStart', { get: () => 12, configurable: true });
    fireEvent.click(textarea, { clientX: 150, clientY: 300 });
    fireEvent.click(screen.getByRole('button', { name: /skip/i }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });
});
