/**
 * Ephemeral client-side note store backed by localStorage.
 *
 * PHI never reaches the server — notes live only in the browser and are
 * purged automatically after 24 hours (or explicitly when the user chooses
 * "Done — Delete Note" after copying to their EMR).
 *
 * Storage key: "docassistai_notes"
 * Shape on disk: LocalNote[]  (JSON-serialised)
 */

export const STORAGE_KEY = 'docassistai_notes';
const MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

export interface LocalSection {
  id: string;
  section_name: string;
  content: string | null;
  confidence: number | null;
  display_order: number;
}

export interface LocalNote {
  id: string;
  note_type: string;
  patient_label: string | null;
  verbosity: 'brief' | 'standard' | 'detailed';
  status: 'draft' | 'finalized';
  transcript: string | null;
  sections: LocalSection[];
  created_at: number; // unix ms
  updated_at: number; // unix ms
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function readAll(): LocalNote[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as LocalNote[];
  } catch {
    return [];
  }
}

function writeAll(notes: LocalNote[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
}

function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback for environments without crypto.randomUUID (some jsdom versions)
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export const localNoteStore = {
  /**
   * Create a new draft note and return it.
   * Mirrors the POST /api/scribe/notes response shape: { note: { id } }.
   */
  create(fields: {
    note_type: string;
    patient_label?: string | null;
    verbosity?: LocalNote['verbosity'];
  }): LocalNote {
    const note: LocalNote = {
      id: newId(),
      note_type: fields.note_type,
      patient_label: fields.patient_label ?? null,
      verbosity: fields.verbosity ?? 'standard',
      status: 'draft',
      transcript: null,
      sections: [],
      created_at: Date.now(),
      updated_at: Date.now(),
    };
    const notes = readAll();
    notes.push(note);
    writeAll(notes);
    return note;
  },

  /** Return a note by id, or null if not found. */
  get(id: string): LocalNote | null {
    return readAll().find(n => n.id === id) ?? null;
  },

  /** Return all notes, newest first by updated_at. */
  list(): LocalNote[] {
    return readAll().sort((a, b) => b.updated_at - a.updated_at);
  },

  /**
   * Merge a partial update into an existing note.
   * Always bumps updated_at.
   */
  update(id: string, patch: Partial<Omit<LocalNote, 'id' | 'created_at'>>): void {
    const notes = readAll();
    const idx = notes.findIndex(n => n.id === id);
    if (idx === -1) return;
    notes[idx] = { ...notes[idx], ...patch, id, updated_at: Date.now() };
    writeAll(notes);
  },

  /** Permanently remove a note (user chose "Done — Delete Note"). */
  delete(id: string): void {
    writeAll(readAll().filter(n => n.id !== id));
  },

  /**
   * Remove all notes older than maxAgeMs (default: 24 h).
   * Call this on dashboard mount as a safety net.
   */
  purgeExpired(maxAgeMs = MAX_AGE_MS): void {
    const cutoff = Date.now() - maxAgeMs;
    writeAll(readAll().filter(n => n.created_at > cutoff));
  },
};
