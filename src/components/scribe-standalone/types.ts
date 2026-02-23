export interface Note {
  id: string;
  note_type: string;
  patient_label: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}
