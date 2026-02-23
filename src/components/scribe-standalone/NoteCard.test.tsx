import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { NoteCard } from './NoteCard';
import { vi } from 'vitest';

const mockNote = {
  id: 'note-1',
  note_type: 'progress_note',
  patient_label: 'Bed 4 - Mr. Johnson',
  status: 'draft',
  created_at: '2026-02-23T10:00:00Z',
  updated_at: '2026-02-23T10:30:00Z',
};

describe('NoteCard', () => {
  it('renders patient label', () => {
    render(<MemoryRouter><NoteCard note={mockNote} onDelete={() => {}} /></MemoryRouter>);
    expect(screen.getByText('Bed 4 - Mr. Johnson')).toBeInTheDocument();
  });

  it('renders note type in readable format', () => {
    render(<MemoryRouter><NoteCard note={mockNote} onDelete={() => {}} /></MemoryRouter>);
    expect(screen.getByText(/progress note/i)).toBeInTheDocument();
  });

  it('renders status badge', () => {
    render(<MemoryRouter><NoteCard note={mockNote} onDelete={() => {}} /></MemoryRouter>);
    expect(screen.getByText(/draft/i)).toBeInTheDocument();
  });

  it('calls onDelete when delete button is clicked', () => {
    const onDelete = vi.fn();
    render(<MemoryRouter><NoteCard note={mockNote} onDelete={onDelete} /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: /delete note/i }));
    fireEvent.click(screen.getByRole('button', { name: /^delete$/i }));
    expect(onDelete).toHaveBeenCalledWith('note-1');
  });

  it('links to the note view page', () => {
    render(<MemoryRouter><NoteCard note={mockNote} onDelete={() => {}} /></MemoryRouter>);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/scribe/note/note-1');
  });
});
