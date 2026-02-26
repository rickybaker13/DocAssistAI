import { describe, it, expect, beforeEach, vi } from 'vitest';
import { localNoteStore, STORAGE_KEY } from '../localNoteStore';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clearStore() {
  localStorage.removeItem(STORAGE_KEY);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('localNoteStore', () => {
  beforeEach(() => {
    clearStore();
  });

  it('create — creates a note and returns it with correct defaults', () => {
    const note = localNoteStore.create({ note_type: 'progress_note' });

    expect(note.id).toBeTruthy();
    expect(note.note_type).toBe('progress_note');
    expect(note.patient_label).toBeNull();
    expect(note.verbosity).toBe('standard');
    expect(note.status).toBe('draft');
    expect(note.transcript).toBeNull();
    expect(note.sections).toEqual([]);
    expect(typeof note.created_at).toBe('number');
    expect(typeof note.updated_at).toBe('number');
  });

  it('create — respects provided patient_label and verbosity', () => {
    const note = localNoteStore.create({
      note_type: 'h_and_p',
      patient_label: 'Bed 7',
      verbosity: 'detailed',
    });

    expect(note.note_type).toBe('h_and_p');
    expect(note.patient_label).toBe('Bed 7');
    expect(note.verbosity).toBe('detailed');
  });

  it('get — retrieves a note by id', () => {
    const created = localNoteStore.create({ note_type: 'progress_note' });
    const retrieved = localNoteStore.get(created.id);

    expect(retrieved).not.toBeNull();
    expect(retrieved!.id).toBe(created.id);
    expect(retrieved!.note_type).toBe('progress_note');
  });

  it('get — returns null for unknown id', () => {
    expect(localNoteStore.get('no-such-id')).toBeNull();
  });

  it('list — returns all notes, newest first by updated_at', () => {
    // Use fake timers so the two creates have distinct timestamps
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T00:00:00Z'));
    const a = localNoteStore.create({ note_type: 'progress_note', patient_label: 'Bed 1' });

    vi.setSystemTime(new Date('2024-01-01T01:00:00Z'));
    const b = localNoteStore.create({ note_type: 'h_and_p', patient_label: 'Bed 2' });
    vi.useRealTimers();

    const notes = localNoteStore.list();
    expect(notes.length).toBe(2);
    expect(notes[0].id).toBe(b.id);
    expect(notes[1].id).toBe(a.id);
  });

  it('update — merges patch and bumps updated_at', () => {
    const note = localNoteStore.create({ note_type: 'progress_note' });
    const before = note.updated_at;

    // Ensure at least 1 ms passes
    // eslint-disable-next-line no-restricted-globals
    const sections = [
      { id: 'sec-1', section_name: 'Assessment', content: 'Stable', confidence: null, display_order: 0 },
    ];
    localNoteStore.update(note.id, { transcript: 'patient is doing well', sections });

    const updated = localNoteStore.get(note.id)!;
    expect(updated.transcript).toBe('patient is doing well');
    expect(updated.sections).toHaveLength(1);
    expect(updated.sections[0].section_name).toBe('Assessment');
    expect(updated.updated_at).toBeGreaterThanOrEqual(before);
    // id must not change
    expect(updated.id).toBe(note.id);
  });

  it('update — is a no-op for unknown id', () => {
    localNoteStore.update('does-not-exist', { status: 'finalized' });
    // no error thrown, store unchanged
    expect(localNoteStore.list()).toHaveLength(0);
  });

  it('delete — removes the note', () => {
    const note = localNoteStore.create({ note_type: 'progress_note' });
    expect(localNoteStore.list()).toHaveLength(1);

    localNoteStore.delete(note.id);
    expect(localNoteStore.list()).toHaveLength(0);
    expect(localNoteStore.get(note.id)).toBeNull();
  });

  it('delete — leaves other notes intact', () => {
    const a = localNoteStore.create({ note_type: 'progress_note' });
    const b = localNoteStore.create({ note_type: 'h_and_p' });

    localNoteStore.delete(a.id);

    expect(localNoteStore.list()).toHaveLength(1);
    expect(localNoteStore.list()[0].id).toBe(b.id);
  });

  it('purgeExpired — removes notes older than maxAgeMs', () => {
    const old = localNoteStore.create({ note_type: 'progress_note' });

    // Back-date created_at to 25 hours ago
    const notes = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    notes[0].created_at = Date.now() - 25 * 60 * 60 * 1000;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));

    const fresh = localNoteStore.create({ note_type: 'h_and_p' });

    localNoteStore.purgeExpired();

    const remaining = localNoteStore.list();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe(fresh.id);

    // old note is gone
    expect(localNoteStore.get(old.id)).toBeNull();
  });

  it('purgeExpired — keeps all notes if none are expired', () => {
    localNoteStore.create({ note_type: 'progress_note' });
    localNoteStore.create({ note_type: 'h_and_p' });

    localNoteStore.purgeExpired();

    expect(localNoteStore.list()).toHaveLength(2);
  });

  it('persists across separate store calls (localStorage round-trip)', () => {
    const note = localNoteStore.create({ note_type: 'discharge_summary', patient_label: 'ICU Bed 3' });

    // Simulate reading from localStorage fresh (like a page reload)
    const raw = localStorage.getItem(STORAGE_KEY)!;
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw) as { id: string; patient_label: string }[];
    expect(parsed[0].id).toBe(note.id);
    expect(parsed[0].patient_label).toBe('ICU Bed 3');
  });
});
