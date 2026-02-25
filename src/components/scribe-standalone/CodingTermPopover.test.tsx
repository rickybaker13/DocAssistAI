import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CodingTermPopover } from './CodingTermPopover';
import { Match } from '../../hooks/useCodingHighlights';

const makeMatch = (): Match => ({
  start: 12, end: 15, original: 'CHF',
  term: {
    vague: 'CHF',
    preferred: ['Acute systolic heart failure', 'Chronic diastolic heart failure', 'Acute on chronic systolic HF'],
    note: 'ICD-10 I50.9 unspecified carries no HCC weight',
    icd10: 'I50.x',
  },
});

describe('CodingTermPopover', () => {
  it('renders the vague term and note', () => {
    render(<CodingTermPopover match={makeMatch()} position={{ x: 100, y: 200 }} onReplace={vi.fn()} onDismiss={vi.fn()} />);
    expect(screen.getByText(/"CHF"/)).toBeInTheDocument();
    expect(screen.getByText(/HCC weight/i)).toBeInTheDocument();
  });

  it('renders all preferred alternatives as buttons', () => {
    render(<CodingTermPopover match={makeMatch()} position={{ x: 100, y: 200 }} onReplace={vi.fn()} onDismiss={vi.fn()} />);
    expect(screen.getByRole('button', { name: /Acute systolic heart failure/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Chronic diastolic heart failure/i })).toBeInTheDocument();
  });

  it('calls onReplace with selected term when option button clicked', () => {
    const onReplace = vi.fn();
    render(<CodingTermPopover match={makeMatch()} position={{ x: 100, y: 200 }} onReplace={onReplace} onDismiss={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /Acute systolic heart failure/i }));
    expect(onReplace).toHaveBeenCalledWith('Acute systolic heart failure');
  });

  it('calls onDismiss when skip button clicked', () => {
    const onDismiss = vi.fn();
    render(<CodingTermPopover match={makeMatch()} position={{ x: 100, y: 200 }} onReplace={vi.fn()} onDismiss={onDismiss} />);
    fireEvent.click(screen.getByRole('button', { name: /skip/i }));
    expect(onDismiss).toHaveBeenCalled();
  });

  it('calls onDismiss when Escape key pressed', () => {
    const onDismiss = vi.fn();
    render(<CodingTermPopover match={makeMatch()} position={{ x: 100, y: 200 }} onReplace={vi.fn()} onDismiss={onDismiss} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onDismiss).toHaveBeenCalled();
  });

  it('calls onDismiss when clicking outside', () => {
    const onDismiss = vi.fn();
    render(
      <div>
        <div data-testid="outside">Outside</div>
        <CodingTermPopover match={makeMatch()} position={{ x: 100, y: 200 }} onReplace={vi.fn()} onDismiss={onDismiss} />
      </div>
    );
    fireEvent.mouseDown(screen.getByTestId('outside'));
    expect(onDismiss).toHaveBeenCalled();
  });
});
