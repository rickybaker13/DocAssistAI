# DocAssistAI Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build DocAssistAI from its current MVP foundation into a full ICU-native clinical intelligence platform — starting with a $19/month Scribe product (quick-win revenue), then layering the Signal Engine (chart intelligence), Chat Mode, and Co-Writer Mode on top.

**Architecture:** A React/TypeScript frontend (already built) launches via SMART on FHIR inside Oracle Health/Cerner, talks to an Express/TypeScript backend, which routes through an AI provider abstraction layer (OpenAI GPT-4o). We add a Signal Engine pipeline service that ingests FHIR resources, normalizes them into a clinical timeline, extracts signal, and feeds all three user-facing modes (Briefing, Chat, Co-Writer). The Population Query layer is scaffolded but not built.

**Tech Stack:** React 18 + TypeScript + Tailwind + Zustand (frontend), Express + TypeScript (backend), fhirclient 2.5.0 (FHIR), OpenAI GPT-4o, Redis (session cache), Web Audio API + Whisper (Scribe audio), SMART on FHIR OAuth 2.0

---

## Context: What Already Exists

The codebase at `/Users/bitbox/Documents/DocAssistAI/` already has:
- ✅ SMART on FHIR OAuth (Cerner) — `src/services/auth/smartAuthService.ts`
- ✅ FHIR resource fetching (Patient, Conditions, Meds, Labs, Vitals, Encounters, Allergies, DiagnosticReports) — `src/services/fhir/fhirClientService.ts`
- ✅ Multi-provider AI abstraction (OpenAI, OpenRouter, self-hosted) — `backend/src/services/ai/providerFactory.ts`
- ✅ Basic chat UI — `src/components/chat/ChatInterface.tsx`
- ✅ Document generation endpoint — `POST /api/ai/generate-document`
- ✅ Audit logging + PHI middleware — `backend/src/middleware/`
- ✅ Zustand stores (patient, chat, auth) — `src/stores/`
- ✅ Recharts for data visualization

**What we are building on top of this foundation:**
1. **v0.1 — Scribe Tier** (audio capture → transcription → note generation → copy/push to EHR)
2. **v0.2 — Signal Engine** (FHIR normalizer → clinical timeline → signal extractor → context object)
3. **v0.3 — Briefing Mode** (proactive structured patient briefing from Signal Engine)
4. **v0.4 — Chat Mode** (cited conversational interface on Signal Engine)
5. **v0.5 — Co-Writer Mode** (note type selection → AI-populated sections → sourced editing)
6. **v0.6 — Population Layer Scaffold** (architecture hooks only, no UI)

---

## v0.1 — Scribe Tier

**What it does:** Clinician taps Record, speaks the encounter or dictates a note, taps Stop, AI transcribes via Whisper and generates a structured note draft. Clinician reviews, edits, and copies to EHR or pushes via the existing `generate-document` endpoint.

**Why first:** Fastest path to a working product clinicians will pay $19/month for. Directly competes with Commure Pro ($59/month) at one-third the price. Uses existing backend AI infrastructure.

---

### Task 1: Add Whisper transcription endpoint to backend

**Files:**
- Create: `backend/src/routes/transcribe.ts`
- Modify: `backend/src/server.ts`
- Create: `backend/src/services/transcription/whisperService.ts`

**Step 1: Write the failing test**

```typescript
// backend/src/services/transcription/whisperService.test.ts
import { WhisperService } from './whisperService';

describe('WhisperService', () => {
  it('throws if no audio buffer provided', async () => {
    const svc = new WhisperService();
    await expect(svc.transcribe(Buffer.alloc(0), 'audio/webm')).rejects.toThrow('Empty audio buffer');
  });

  it('returns transcript string on valid input', async () => {
    // This test will pass once real Whisper integration is wired
    // For now mock the OpenAI call
    const svc = new WhisperService();
    jest.spyOn(svc as any, 'callWhisper').mockResolvedValue('Patient presents with shortness of breath.');
    const result = await svc.transcribe(Buffer.from('fake'), 'audio/webm');
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd /Users/bitbox/Documents/DocAssistAI/backend
npx jest whisperService --no-coverage
```
Expected: FAIL — `WhisperService` not found.

**Step 3: Implement WhisperService**

```typescript
// backend/src/services/transcription/whisperService.ts
import OpenAI from 'openai';
import { Readable } from 'stream';
import FormData from 'form-data';

export class WhisperService {
  private client: OpenAI;

  constructor() {
    this.client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  async transcribe(audioBuffer: Buffer, mimeType: string): Promise<string> {
    if (!audioBuffer || audioBuffer.length === 0) {
      throw new Error('Empty audio buffer');
    }
    return this.callWhisper(audioBuffer, mimeType);
  }

  private async callWhisper(audioBuffer: Buffer, mimeType: string): Promise<string> {
    const ext = mimeType.includes('webm') ? 'webm' : mimeType.includes('mp4') ? 'mp4' : 'wav';
    const file = new File([audioBuffer], `recording.${ext}`, { type: mimeType });
    const response = await this.client.audio.transcriptions.create({
      file,
      model: 'whisper-1',
      language: 'en',
      prompt: 'Medical clinical encounter. Use medical terminology accurately.',
    });
    return response.text;
  }
}
```

**Step 4: Create transcription route**

```typescript
// backend/src/routes/transcribe.ts
import { Router, Request, Response } from 'express';
import multer from 'multer';
import { WhisperService } from '../services/transcription/whisperService';
import { auditLogger } from '../services/audit/auditLogger';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });
const whisper = new WhisperService();

router.post('/transcribe', upload.single('audio'), async (req: Request, res: Response) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No audio file provided' });
    const transcript = await whisper.transcribe(req.file.buffer, req.file.mimetype);
    auditLogger.log('AI_SERVICE', { action: 'TRANSCRIBE', userId: req.headers['x-user-id'], patientId: req.headers['x-patient-id'] });
    res.json({ transcript });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
```

**Step 5: Register route in server.ts**

```typescript
// In backend/src/server.ts — add after existing route registrations:
import transcribeRouter from './routes/transcribe';
app.use('/api/ai', transcribeRouter);
```

**Step 6: Install multer**

```bash
cd /Users/bitbox/Documents/DocAssistAI/backend
npm install multer @types/multer
```

**Step 7: Run tests to verify they pass**

```bash
npx jest whisperService --no-coverage
```
Expected: PASS

**Step 8: Commit**

```bash
cd /Users/bitbox/Documents/DocAssistAI
git add backend/src/routes/transcribe.ts backend/src/services/transcription/whisperService.ts backend/src/server.ts backend/package.json
git commit -m "feat: add Whisper transcription endpoint POST /api/ai/transcribe"
```

---

### Task 2: Build audio recording UI component

**Files:**
- Create: `src/components/scribe/AudioRecorder.tsx`
- Create: `src/components/scribe/AudioRecorder.test.tsx`
- Create: `src/stores/scribeStore.ts`

**Step 1: Write the failing test**

```typescript
// src/components/scribe/AudioRecorder.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { AudioRecorder } from './AudioRecorder';

describe('AudioRecorder', () => {
  it('renders Record button initially', () => {
    render(<AudioRecorder onTranscript={() => {}} />);
    expect(screen.getByRole('button', { name: /record/i })).toBeInTheDocument();
  });

  it('shows Stop button while recording', async () => {
    render(<AudioRecorder onTranscript={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /record/i }));
    expect(await screen.findByRole('button', { name: /stop/i })).toBeInTheDocument();
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd /Users/bitbox/Documents/DocAssistAI
npx vitest run src/components/scribe/AudioRecorder.test.tsx
```
Expected: FAIL — component not found.

**Step 3: Create Zustand scribe store**

```typescript
// src/stores/scribeStore.ts
import { create } from 'zustand';

interface ScribeState {
  isRecording: boolean;
  transcript: string;
  generatedNote: string;
  isTranscribing: boolean;
  isGenerating: boolean;
  error: string | null;
  setRecording: (v: boolean) => void;
  setTranscript: (t: string) => void;
  setGeneratedNote: (n: string) => void;
  setTranscribing: (v: boolean) => void;
  setGenerating: (v: boolean) => void;
  setError: (e: string | null) => void;
  reset: () => void;
}

export const useScribeStore = create<ScribeState>((set) => ({
  isRecording: false,
  transcript: '',
  generatedNote: '',
  isTranscribing: false,
  isGenerating: false,
  error: null,
  setRecording: (v) => set({ isRecording: v }),
  setTranscript: (t) => set({ transcript: t }),
  setGeneratedNote: (n) => set({ generatedNote: n }),
  setTranscribing: (v) => set({ isTranscribing: v }),
  setGenerating: (v) => set({ isGenerating: v }),
  setError: (e) => set({ error: e }),
  reset: () => set({ isRecording: false, transcript: '', generatedNote: '', isTranscribing: false, isGenerating: false, error: null }),
}));
```

**Step 4: Implement AudioRecorder component**

```typescript
// src/components/scribe/AudioRecorder.tsx
import React, { useRef, useState } from 'react';

interface Props {
  onTranscript: (transcript: string) => void;
  onError?: (error: string) => void;
}

export const AudioRecorder: React.FC<Props> = ({ onTranscript, onError }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      chunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = () => handleRecordingStop(stream);
      recorder.start(1000);
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      timerRef.current = setInterval(() => setDuration(d => d + 1), 1000);
    } catch (err: any) {
      onError?.(err.message);
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    if (timerRef.current) clearInterval(timerRef.current);
    setIsRecording(false);
    setDuration(0);
  };

  const handleRecordingStop = async (stream: MediaStream) => {
    stream.getTracks().forEach(t => t.stop());
    const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
    const formData = new FormData();
    formData.append('audio', blob, 'recording.webm');
    try {
      const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/ai/transcribe`, {
        method: 'POST',
        body: formData,
        headers: { 'X-Patient-Id': sessionStorage.getItem('patientId') || '' },
      });
      const data = await res.json();
      if (data.transcript) onTranscript(data.transcript);
      else onError?.(data.error || 'Transcription failed');
    } catch (err: any) {
      onError?.(err.message);
    }
  };

  const formatDuration = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  return (
    <div className="flex flex-col items-center gap-3">
      {isRecording && (
        <div className="flex items-center gap-2 text-red-500 font-mono text-sm">
          <span className="animate-pulse h-2 w-2 rounded-full bg-red-500" />
          Recording {formatDuration(duration)}
        </div>
      )}
      <button
        onClick={isRecording ? stopRecording : startRecording}
        className={`px-6 py-3 rounded-full font-semibold text-white transition-all ${
          isRecording
            ? 'bg-red-500 hover:bg-red-600 animate-pulse'
            : 'bg-blue-600 hover:bg-blue-700'
        }`}
      >
        {isRecording ? '⏹ Stop' : '🎙 Record'}
      </button>
    </div>
  );
};
```

**Step 5: Run tests**

```bash
npx vitest run src/components/scribe/AudioRecorder.test.tsx
```
Expected: PASS

**Step 6: Commit**

```bash
git add src/components/scribe/ src/stores/scribeStore.ts
git commit -m "feat: add AudioRecorder component and scribeStore"
```

---

### Task 3: Build Scribe note generation UI

**Files:**
- Create: `src/components/scribe/ScribePanel.tsx`
- Create: `src/components/scribe/NoteEditor.tsx`
- Modify: `src/App.tsx` (add Scribe tab)

**Step 1: Create NoteEditor**

```typescript
// src/components/scribe/NoteEditor.tsx
import React from 'react';

interface Props {
  note: string;
  onChange: (value: string) => void;
  onCopy: () => void;
}

export const NoteEditor: React.FC<Props> = ({ note, onChange, onCopy }) => (
  <div className="flex flex-col gap-2">
    <div className="flex justify-between items-center">
      <h3 className="text-sm font-semibold text-gray-700">Generated Note</h3>
      <button
        onClick={onCopy}
        className="text-xs px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700"
      >
        Copy to Clipboard
      </button>
    </div>
    <textarea
      value={note}
      onChange={(e) => onChange(e.target.value)}
      className="w-full h-64 p-3 border border-gray-300 rounded-lg font-mono text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
      placeholder="Generated note will appear here..."
    />
  </div>
);
```

**Step 2: Create ScribePanel**

```typescript
// src/components/scribe/ScribePanel.tsx
import React from 'react';
import { AudioRecorder } from './AudioRecorder';
import { NoteEditor } from './NoteEditor';
import { useScribeStore } from '../../stores/scribeStore';

const NOTE_TYPES = ['Progress Note', 'H&P', 'Transfer Note', 'Accept Note', 'Consult Note', 'Discharge Summary', 'Procedure Note'];

export const ScribePanel: React.FC = () => {
  const { transcript, generatedNote, isGenerating, error, setTranscript, setGeneratedNote, setGenerating, setError } = useScribeStore();
  const [noteType, setNoteType] = React.useState('Progress Note');

  const handleTranscript = async (text: string) => {
    setTranscript(text);
    setGenerating(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/ai/generate-document`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          template: noteType,
          context: text,
          instructions: `Generate a structured ${noteType} based on this transcription. Use standard medical formatting. Be concise and clinically precise.`,
        }),
      });
      const data = await res.json();
      setGeneratedNote(data.document || data.content || '');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedNote);
  };

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-gray-700">Note Type:</label>
        <select
          value={noteType}
          onChange={(e) => setNoteType(e.target.value)}
          className="border border-gray-300 rounded px-2 py-1 text-sm"
        >
          {NOTE_TYPES.map(t => <option key={t}>{t}</option>)}
        </select>
      </div>

      <AudioRecorder onTranscript={handleTranscript} onError={setError} />

      {error && <p className="text-red-500 text-sm">{error}</p>}

      {transcript && (
        <div className="bg-gray-50 rounded p-3">
          <p className="text-xs font-semibold text-gray-500 mb-1">Transcript</p>
          <p className="text-sm text-gray-700">{transcript}</p>
        </div>
      )}

      {isGenerating && (
        <div className="text-center text-blue-600 text-sm animate-pulse">Generating note...</div>
      )}

      {generatedNote && (
        <NoteEditor note={generatedNote} onChange={setGeneratedNote} onCopy={handleCopy} />
      )}
    </div>
  );
};
```

**Step 3: Add Scribe tab to App.tsx**

In `src/App.tsx`, find the existing tab/navigation structure and add a "Scribe" tab that renders `<ScribePanel />`. The exact insertion point depends on the current nav — look for where `ChatInterface` is rendered and add a parallel tab.

**Step 4: Start dev server and manually test**

```bash
cd /Users/bitbox/Documents/DocAssistAI
npm run dev
```

Test flow:
1. Launch app → navigate to Scribe tab
2. Select note type → tap Record → speak for 10 seconds → tap Stop
3. Verify transcript appears
4. Verify note is generated
5. Verify Copy to Clipboard works

**Step 5: Commit**

```bash
git add src/components/scribe/ScribePanel.tsx src/components/scribe/NoteEditor.tsx src/App.tsx
git commit -m "feat: complete Scribe tier v0.1 — record, transcribe, generate, copy"
```

---

## v0.2 — Signal Engine Core

**What it does:** A backend pipeline service that ingests all FHIR resources for a patient, normalizes them into a unified clinical timeline, extracts clinically significant signal (what changed, what's trending, what's missing), and stores a time-windowed patient context object in Redis. This is the foundation all three modes (Briefing, Chat, Co-Writer) read from.

**Key principle:** The engine runs once per patient per session. All three modes are just different views on the same context object.

---

### Task 4: Extend FHIR fetching for ICU data types

**Files:**
- Modify: `src/services/fhir/fhirClientService.ts`
- Create: `src/services/fhir/fhirClientService.test.ts`

**Step 1: Write failing tests for new resource types**

```typescript
// src/services/fhir/fhirClientService.test.ts
import { FhirClientService } from './fhirClientService';

describe('FhirClientService — ICU extensions', () => {
  let svc: FhirClientService;

  beforeEach(() => {
    svc = new FhirClientService();
    // Mock fhirclient
    (svc as any).client = {
      request: jest.fn().mockResolvedValue({ entry: [] }),
    };
  });

  it('fetches MedicationAdministration records', async () => {
    const result = await svc.getMedicationAdministrations('patient-123');
    expect(Array.isArray(result)).toBe(true);
  });

  it('fetches DeviceMetric (ventilator) records', async () => {
    const result = await svc.getDeviceMetrics('patient-123');
    expect(Array.isArray(result)).toBe(true);
  });

  it('fetches all labs with configurable count', async () => {
    const result = await svc.getLabs('patient-123', 100);
    expect(Array.isArray(result)).toBe(true);
  });

  it('fetches vitals with configurable count and time window', async () => {
    const result = await svc.getVitals('patient-123', 200, 48);
    expect(Array.isArray(result)).toBe(true);
  });
});
```

**Step 2: Run to verify failures**

```bash
cd /Users/bitbox/Documents/DocAssistAI
npx vitest run src/services/fhir/fhirClientService.test.ts
```

**Step 3: Add new methods to fhirClientService.ts**

Add these methods to the existing `FhirClientService` class:

```typescript
// Medication administrations (drip titrations, PRN doses)
async getMedicationAdministrations(patientId: string, count = 100): Promise<fhir4.MedicationAdministration[]> {
  const bundle = await this.client.request<fhir4.Bundle>(
    `MedicationAdministration?patient=${patientId}&_sort=-effective-time&_count=${count}`
  );
  return (bundle.entry || []).map(e => e.resource as fhir4.MedicationAdministration).filter(Boolean);
}

// Device metrics: ventilator settings, hemodynamic monitoring
async getDeviceMetrics(patientId: string, count = 200): Promise<fhir4.DeviceMetric[]> {
  const bundle = await this.client.request<fhir4.Bundle>(
    `DeviceMetric?patient=${patientId}&_count=${count}`
  );
  return (bundle.entry || []).map(e => e.resource as fhir4.DeviceMetric).filter(Boolean);
}

// Extend getLabs with configurable count
async getLabs(patientId: string, count = 50, hoursBack = 48): Promise<fhir4.Observation[]> {
  const since = new Date(Date.now() - hoursBack * 3600000).toISOString();
  const bundle = await this.client.request<fhir4.Bundle>(
    `Observation?patient=${patientId}&category=laboratory&date=ge${since}&_sort=-date&_count=${count}`
  );
  return (bundle.entry || []).map(e => e.resource as fhir4.Observation).filter(Boolean);
}

// Extend getVitals with configurable count and time window
async getVitals(patientId: string, count = 200, hoursBack = 48): Promise<fhir4.Observation[]> {
  const since = new Date(Date.now() - hoursBack * 3600000).toISOString();
  const bundle = await this.client.request<fhir4.Bundle>(
    `Observation?patient=${patientId}&category=vital-signs&date=ge${since}&_sort=-date&_count=${count}`
  );
  return (bundle.entry || []).map(e => e.resource as fhir4.Observation).filter(Boolean);
}

// ICU full data pull — all resources in parallel
async getICUPatientData(patientId: string): Promise<ICUPatientData> {
  const [patient, conditions, medications, medicationAdmins, labs, vitals, encounters, allergies, diagnosticReports, procedures, notes, deviceMetrics] = await Promise.all([
    this.getPatient(),
    this.getConditions(),
    this.getMedications(),
    this.getMedicationAdministrations(patientId),
    this.getLabs(patientId, 200, 48),
    this.getVitals(patientId, 500, 48),
    this.getEncounters(),
    this.getAllergies(),
    this.getDiagnosticReports(),
    this.getProcedures(),
    this.getClinicalNotes(patientId),
    this.getDeviceMetrics(patientId),
  ]);
  return { patient, conditions, medications, medicationAdmins, labs, vitals, encounters, allergies, diagnosticReports, procedures, notes, deviceMetrics, fetchedAt: new Date().toISOString() };
}

// Clinical notes (all DocumentReference)
async getClinicalNotes(patientId: string, count = 20): Promise<fhir4.DocumentReference[]> {
  const bundle = await this.client.request<fhir4.Bundle>(
    `DocumentReference?patient=${patientId}&_sort=-date&_count=${count}`
  );
  return (bundle.entry || []).map(e => e.resource as fhir4.DocumentReference).filter(Boolean);
}
```

**Step 4: Add ICUPatientData type**

```typescript
// src/types/index.ts — add:
export interface ICUPatientData {
  patient: fhir4.Patient;
  conditions: fhir4.Condition[];
  medications: fhir4.MedicationRequest[];
  medicationAdmins: fhir4.MedicationAdministration[];
  labs: fhir4.Observation[];
  vitals: fhir4.Observation[];
  encounters: fhir4.Encounter[];
  allergies: fhir4.AllergyIntolerance[];
  diagnosticReports: fhir4.DiagnosticReport[];
  procedures: fhir4.Procedure[];
  notes: fhir4.DocumentReference[];
  deviceMetrics: fhir4.DeviceMetric[];
  fetchedAt: string;
}
```

**Step 5: Run tests**

```bash
npx vitest run src/services/fhir/fhirClientService.test.ts
```
Expected: PASS

**Step 6: Commit**

```bash
git add src/services/fhir/fhirClientService.ts src/types/index.ts
git commit -m "feat: extend FHIR service with ICU data types (MedAdmin, DeviceMetric, time-windowed labs/vitals)"
```

---

### Task 5: Build Signal Engine pipeline (backend)

**Files:**
- Create: `backend/src/services/signal/signalEngine.ts`
- Create: `backend/src/services/signal/fhirNormalizer.ts`
- Create: `backend/src/services/signal/timelineBuilder.ts`
- Create: `backend/src/services/signal/signalExtractor.ts`
- Create: `backend/src/services/signal/contextStore.ts`
- Create: `backend/src/routes/signal.ts`
- Create: `backend/src/services/signal/signalEngine.test.ts`

**Step 1: Write failing tests**

```typescript
// backend/src/services/signal/signalEngine.test.ts
import { SignalEngine } from './signalEngine';
import { mockICUPatientData } from './__mocks__/mockICUPatientData';

describe('SignalEngine', () => {
  let engine: SignalEngine;

  beforeEach(() => {
    engine = new SignalEngine();
  });

  it('normalizes FHIR data into a clinical timeline', async () => {
    const timeline = engine.normalize(mockICUPatientData);
    expect(Array.isArray(timeline.events)).toBe(true);
    expect(timeline.events.length).toBeGreaterThan(0);
    expect(timeline.events[0]).toHaveProperty('timestamp');
    expect(timeline.events[0]).toHaveProperty('type');
    expect(timeline.events[0]).toHaveProperty('data');
  });

  it('extracts signal for a given time window', async () => {
    const timeline = engine.normalize(mockICUPatientData);
    const signal = await engine.extractSignal(timeline, { hoursBack: 24, patientId: 'test-123' });
    expect(signal).toHaveProperty('headline');
    expect(signal).toHaveProperty('domains');
    expect(signal).toHaveProperty('pending');
    expect(signal).toHaveProperty('stable');
    expect(Array.isArray(signal.domains)).toBe(true);
  });

  it('returns a stable/unchanged section when no significant changes', async () => {
    const timeline = engine.normalize(mockICUPatientData);
    const signal = await engine.extractSignal(timeline, { hoursBack: 1, patientId: 'test-123' });
    expect(signal).toHaveProperty('stable');
  });
});
```

**Step 2: Run to verify failures**

```bash
cd /Users/bitbox/Documents/DocAssistAI/backend
npx jest signalEngine --no-coverage
```
Expected: FAIL

**Step 3: Build FHIR Normalizer**

```typescript
// backend/src/services/signal/fhirNormalizer.ts
export interface ClinicalEvent {
  timestamp: string;
  type: 'lab' | 'vital' | 'medication' | 'med_admin' | 'note' | 'diagnosis' | 'procedure' | 'report' | 'device';
  label: string;
  value?: string | number;
  unit?: string;
  referenceRange?: string;
  isAbnormal?: boolean;
  source: string; // FHIR resource ID
  raw?: any;
}

export interface ClinicalTimeline {
  patientId: string;
  events: ClinicalEvent[];
  builtAt: string;
}

export class FhirNormalizer {
  normalize(data: any): ClinicalTimeline {
    const events: ClinicalEvent[] = [];

    // Normalize labs
    (data.labs || []).forEach((obs: any) => {
      events.push({
        timestamp: obs.effectiveDateTime || obs.issued || new Date().toISOString(),
        type: 'lab',
        label: obs.code?.text || obs.code?.coding?.[0]?.display || 'Unknown Lab',
        value: obs.valueQuantity?.value ?? obs.valueString ?? obs.valueCodeableConcept?.text,
        unit: obs.valueQuantity?.unit,
        referenceRange: obs.referenceRange?.[0]?.text,
        isAbnormal: obs.interpretation?.[0]?.coding?.[0]?.code !== 'N',
        source: obs.id || '',
        raw: obs,
      });
    });

    // Normalize vitals
    (data.vitals || []).forEach((obs: any) => {
      events.push({
        timestamp: obs.effectiveDateTime || obs.issued || new Date().toISOString(),
        type: 'vital',
        label: obs.code?.text || obs.code?.coding?.[0]?.display || 'Unknown Vital',
        value: obs.valueQuantity?.value,
        unit: obs.valueQuantity?.unit,
        isAbnormal: obs.interpretation?.[0]?.coding?.[0]?.code !== 'N',
        source: obs.id || '',
        raw: obs,
      });
    });

    // Normalize medication administrations
    (data.medicationAdmins || []).forEach((ma: any) => {
      events.push({
        timestamp: ma.effectiveDateTime || ma.effectivePeriod?.start || new Date().toISOString(),
        type: 'med_admin',
        label: ma.medicationCodeableConcept?.text || ma.medicationCodeableConcept?.coding?.[0]?.display || 'Medication',
        value: ma.dosage?.dose?.value,
        unit: ma.dosage?.dose?.unit,
        source: ma.id || '',
        raw: ma,
      });
    });

    // Normalize diagnostic reports
    (data.diagnosticReports || []).forEach((dr: any) => {
      events.push({
        timestamp: dr.effectiveDateTime || dr.issued || new Date().toISOString(),
        type: 'report',
        label: dr.code?.text || dr.code?.coding?.[0]?.display || 'Report',
        value: dr.conclusion,
        source: dr.id || '',
        raw: dr,
      });
    });

    // Sort by timestamp descending
    events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return {
      patientId: data.patient?.id || '',
      events,
      builtAt: new Date().toISOString(),
    };
  }
}
```

**Step 4: Build Signal Extractor**

```typescript
// backend/src/services/signal/signalExtractor.ts
import OpenAI from 'openai';
import { ClinicalTimeline } from './fhirNormalizer';

export interface SignalDomain {
  name: string; // 'hemodynamics' | 'respiratory' | 'renal' | 'infectious' | 'neuro' | 'lines_tubes_drains'
  findings: string[];
  trend?: 'improving' | 'worsening' | 'stable' | 'new';
}

export interface PatientSignal {
  headline: string;
  domains: SignalDomain[];
  pending: string[];
  stable: string[];
  generatedAt: string;
  timeWindowHours: number;
}

export class SignalExtractor {
  private client: OpenAI;

  constructor() {
    this.client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  async extract(timeline: ClinicalTimeline, hoursBack: number): Promise<PatientSignal> {
    const cutoff = new Date(Date.now() - hoursBack * 3600000).toISOString();
    const recentEvents = timeline.events.filter(e => e.timestamp >= cutoff);
    const allEvents = timeline.events;

    const prompt = this.buildPrompt(recentEvents, allEvents, hoursBack);

    const response = await this.client.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are a critical care physician AI assistant. You analyze patient data and extract clinically significant signal from noise.
You return structured JSON only. Be concise, clinically precise, and prioritize acuity.
Focus on: hemodynamics, respiratory, renal, infectious disease, neurology, lines/tubes/drains.
Flag: abnormal trends, new findings, pending results, clinical deterioration or improvement.
Ignore: routine stable findings, expected post-op course items, minor fluctuations within normal range.`,
        },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1,
    });

    const content = response.choices[0].message.content || '{}';
    const parsed = JSON.parse(content);

    return {
      headline: parsed.headline || 'No significant acute findings in this time window.',
      domains: parsed.domains || [],
      pending: parsed.pending || [],
      stable: parsed.stable || [],
      generatedAt: new Date().toISOString(),
      timeWindowHours: hoursBack,
    };
  }

  private buildPrompt(recentEvents: any[], allEvents: any[], hoursBack: number): string {
    const recentSummary = recentEvents.slice(0, 150).map(e =>
      `[${e.timestamp}] ${e.type.toUpperCase()} | ${e.label}: ${e.value ?? ''} ${e.unit ?? ''} ${e.isAbnormal ? '⚠️ ABNORMAL' : ''}`
    ).join('\n');

    return `Analyze the following ICU patient data from the last ${hoursBack} hours and extract clinical signal.

RECENT DATA (last ${hoursBack}h):
${recentSummary}

Return JSON with this exact structure:
{
  "headline": "single most important clinical finding or action item",
  "domains": [
    {
      "name": "hemodynamics|respiratory|renal|infectious|neuro|lines_tubes_drains",
      "findings": ["concise finding 1", "concise finding 2"],
      "trend": "improving|worsening|stable|new"
    }
  ],
  "pending": ["pending culture x48h", "CT read pending", "nephrology consult not yet in"],
  "stable": ["ventilator settings unchanged x12h", "renal function at baseline"]
}

Only include domains with meaningful findings. Be brief — each finding should be one sentence maximum.`;
  }
}
```

**Step 5: Build Context Store (Redis-backed, session-scoped)**

```typescript
// backend/src/services/signal/contextStore.ts
// Uses in-memory Map for v0.2; swap to Redis in production
import { PatientSignal } from './signalExtractor';
import { ClinicalTimeline } from './fhirNormalizer';

interface CachedContext {
  timeline: ClinicalTimeline;
  signals: Record<number, PatientSignal>; // keyed by hoursBack
  cachedAt: string;
  patientId: string;
}

const cache = new Map<string, CachedContext>();
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

export class ContextStore {
  set(sessionId: string, patientId: string, timeline: ClinicalTimeline): void {
    const existing = cache.get(sessionId) || { signals: {}, cachedAt: '', patientId: '' };
    cache.set(sessionId, { timeline, signals: existing.signals, cachedAt: new Date().toISOString(), patientId });
  }

  setSignal(sessionId: string, hoursBack: number, signal: PatientSignal): void {
    const existing = cache.get(sessionId);
    if (existing) {
      existing.signals[hoursBack] = signal;
      cache.set(sessionId, existing);
    }
  }

  get(sessionId: string): CachedContext | null {
    const ctx = cache.get(sessionId);
    if (!ctx) return null;
    if (Date.now() - new Date(ctx.cachedAt).getTime() > CACHE_TTL_MS) {
      cache.delete(sessionId);
      return null;
    }
    return ctx;
  }

  getSignal(sessionId: string, hoursBack: number): PatientSignal | null {
    return this.get(sessionId)?.signals[hoursBack] || null;
  }

  invalidate(sessionId: string): void {
    cache.delete(sessionId);
  }
}

export const contextStore = new ContextStore();
```

**Step 6: Build Signal Engine orchestrator**

```typescript
// backend/src/services/signal/signalEngine.ts
import { FhirNormalizer, ClinicalTimeline } from './fhirNormalizer';
import { SignalExtractor, PatientSignal } from './signalExtractor';
import { contextStore } from './contextStore';

export class SignalEngine {
  private normalizer = new FhirNormalizer();
  private extractor = new SignalExtractor();

  normalize(data: any): ClinicalTimeline {
    return this.normalizer.normalize(data);
  }

  async extractSignal(timeline: ClinicalTimeline, opts: { hoursBack: number; patientId: string }): Promise<PatientSignal> {
    return this.extractor.extract(timeline, opts.hoursBack);
  }

  async process(sessionId: string, patientData: any, hoursBack = 24): Promise<PatientSignal> {
    // Check cache first
    const cached = contextStore.getSignal(sessionId, hoursBack);
    if (cached) return cached;

    // Normalize and extract
    const timeline = this.normalizer.normalize(patientData);
    contextStore.set(sessionId, patientData.patient?.id || '', timeline);

    const signal = await this.extractor.extract(timeline, hoursBack);
    contextStore.setSignal(sessionId, hoursBack, signal);

    return signal;
  }
}

export const signalEngine = new SignalEngine();
```

**Step 7: Create Signal API route**

```typescript
// backend/src/routes/signal.ts
import { Router, Request, Response } from 'express';
import { signalEngine } from '../services/signal/signalEngine';
import { auditLogger } from '../services/audit/auditLogger';

const router = Router();

// POST /api/signal/process — accepts ICU patient data, returns signal
router.post('/process', async (req: Request, res: Response) => {
  try {
    const { patientData, hoursBack = 24 } = req.body;
    const sessionId = req.headers['x-session-id'] as string || req.headers['x-patient-id'] as string || 'default';

    if (!patientData) return res.status(400).json({ error: 'patientData required' });

    const signal = await signalEngine.process(sessionId, patientData, hoursBack);
    auditLogger.log('AI_SERVICE', { action: 'SIGNAL_EXTRACT', userId: req.headers['x-user-id'], patientId: req.headers['x-patient-id'] });
    res.json({ signal });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/signal/invalidate — clear cached context for session
router.post('/invalidate', (req: Request, res: Response) => {
  const sessionId = req.headers['x-session-id'] as string || '';
  if (sessionId) {
    const { contextStore } = require('../services/signal/contextStore');
    contextStore.invalidate(sessionId);
  }
  res.json({ ok: true });
});

// Population query scaffold — not implemented yet
router.post('/population', (_req: Request, res: Response) => {
  res.status(501).json({ error: 'Population query engine not yet implemented', roadmap: 'v1.0' });
});

export default router;
```

**Step 8: Register signal route in server.ts**

```typescript
// backend/src/server.ts — add:
import signalRouter from './routes/signal';
app.use('/api/signal', signalRouter);
```

**Step 9: Run tests**

```bash
cd /Users/bitbox/Documents/DocAssistAI/backend
npx jest signalEngine --no-coverage
```
Expected: PASS

**Step 10: Commit**

```bash
git add backend/src/services/signal/ backend/src/routes/signal.ts backend/src/server.ts
git commit -m "feat: Signal Engine v0.2 — FHIR normalizer, signal extractor, context store, /api/signal/process"
```

---

## v0.3 — Briefing Mode

**What it does:** When a clinician opens a patient, DocAssistAI automatically fetches all ICU data, runs it through the Signal Engine, and presents a structured clinical briefing — headline, domain findings, pending items, stable items — before they touch a note. Time window is adjustable (6h/12h/24h/48h).

---

### Task 6: Build Briefing Mode frontend

**Files:**
- Create: `src/components/briefing/BriefingPanel.tsx`
- Create: `src/components/briefing/SignalDomainCard.tsx`
- Create: `src/services/signal/signalService.ts`
- Modify: `src/App.tsx` (add Briefing as default/first tab)

**Step 1: Create signal service (frontend)**

```typescript
// src/services/signal/signalService.ts
import axios from 'axios';
import { ICUPatientData } from '../../types';

const BASE = import.meta.env.VITE_BACKEND_URL;

export const signalService = {
  async process(patientData: ICUPatientData, hoursBack: number, sessionId: string) {
    const res = await axios.post(`${BASE}/api/signal/process`, { patientData, hoursBack }, {
      headers: {
        'X-Patient-Id': patientData.patient.id || '',
        'X-Session-Id': sessionId,
      },
    });
    return res.data.signal;
  },
};
```

**Step 2: Create SignalDomainCard component**

```typescript
// src/components/briefing/SignalDomainCard.tsx
import React from 'react';

interface Domain {
  name: string;
  findings: string[];
  trend?: string;
}

const DOMAIN_ICONS: Record<string, string> = {
  hemodynamics: '❤️',
  respiratory: '🫁',
  renal: '🫘',
  infectious: '🦠',
  neuro: '🧠',
  lines_tubes_drains: '📌',
};

const TREND_COLORS: Record<string, string> = {
  improving: 'text-green-600',
  worsening: 'text-red-600',
  stable: 'text-gray-500',
  new: 'text-orange-500',
};

export const SignalDomainCard: React.FC<{ domain: Domain }> = ({ domain }) => (
  <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm">
    <div className="flex items-center gap-2 mb-2">
      <span className="text-lg">{DOMAIN_ICONS[domain.name] || '📋'}</span>
      <span className="font-semibold text-gray-800 capitalize">{domain.name.replace(/_/g, ' ')}</span>
      {domain.trend && (
        <span className={`text-xs font-medium ml-auto ${TREND_COLORS[domain.trend] || 'text-gray-500'}`}>
          {domain.trend.toUpperCase()}
        </span>
      )}
    </div>
    <ul className="space-y-1">
      {domain.findings.map((f, i) => (
        <li key={i} className="text-sm text-gray-700 flex gap-2">
          <span className="text-gray-400 mt-0.5">•</span>
          <span>{f}</span>
        </li>
      ))}
    </ul>
  </div>
);
```

**Step 3: Create BriefingPanel**

```typescript
// src/components/briefing/BriefingPanel.tsx
import React, { useEffect, useState } from 'react';
import { signalService } from '../../services/signal/signalService';
import { SignalDomainCard } from './SignalDomainCard';
import { usePatientStore } from '../../stores/patientStore';
import { fhirClientService } from '../../services/fhir/fhirClientService';

const TIME_WINDOWS = [6, 12, 24, 48] as const;

export const BriefingPanel: React.FC = () => {
  const [signal, setSignal] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hoursBack, setHoursBack] = useState<number>(24);
  const [showStable, setShowStable] = useState(false);
  const { patient } = usePatientStore();

  const loadBriefing = async (hours: number) => {
    setLoading(true);
    setError(null);
    try {
      const patientData = await fhirClientService.getICUPatientData(patient?.id || '');
      const sessionId = `${patient?.id || 'anon'}-${Date.now()}`;
      const result = await signalService.process(patientData, hours, sessionId);
      setSignal(result);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (patient?.id) loadBriefing(hoursBack); }, [patient?.id]);

  const handleWindowChange = (hours: number) => {
    setHoursBack(hours);
    loadBriefing(hours);
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-48 gap-3">
      <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full" />
      <p className="text-sm text-gray-500">Analyzing patient data...</p>
    </div>
  );

  if (error) return <div className="text-red-500 p-4 text-sm">{error}</div>;
  if (!signal) return null;

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Time window selector */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500 font-medium">Time window:</span>
        {TIME_WINDOWS.map(h => (
          <button
            key={h}
            onClick={() => handleWindowChange(h)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
              hoursBack === h ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {h}h
          </button>
        ))}
        <button
          onClick={() => loadBriefing(hoursBack)}
          className="ml-auto text-xs text-blue-600 hover:underline"
        >
          ↻ Refresh
        </button>
      </div>

      {/* Headline */}
      <div className="bg-yellow-50 border-l-4 border-yellow-400 rounded-r-lg p-3">
        <p className="text-xs font-semibold text-yellow-700 mb-1">KEY FINDING</p>
        <p className="text-sm font-medium text-gray-800">{signal.headline}</p>
      </div>

      {/* Domain findings */}
      <div className="grid grid-cols-1 gap-3">
        {signal.domains?.map((domain: any, i: number) => (
          <SignalDomainCard key={i} domain={domain} />
        ))}
      </div>

      {/* Pending */}
      {signal.pending?.length > 0 && (
        <div className="bg-orange-50 rounded-lg p-3">
          <p className="text-xs font-semibold text-orange-700 mb-2">⏳ PENDING</p>
          <ul className="space-y-1">
            {signal.pending.map((p: string, i: number) => (
              <li key={i} className="text-sm text-gray-700">• {p}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Stable — collapsed by default */}
      {signal.stable?.length > 0 && (
        <div className="bg-gray-50 rounded-lg p-3">
          <button
            onClick={() => setShowStable(!showStable)}
            className="text-xs font-semibold text-gray-500 flex items-center gap-1"
          >
            ✓ STABLE / UNCHANGED {showStable ? '▲' : '▼'}
          </button>
          {showStable && (
            <ul className="mt-2 space-y-1">
              {signal.stable.map((s: string, i: number) => (
                <li key={i} className="text-sm text-gray-500">• {s}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};
```

**Step 4: Wire BriefingPanel into App.tsx as the default tab**

Find the tab navigation in `src/App.tsx` and make Briefing the first/default tab. Add tabs: Briefing | Scribe | Chat | Co-Writer (last two are stubs for now).

**Step 5: Manual test**

```bash
npm run dev
```

Test: Launch app in mock mode. Verify briefing panel renders, time window buttons work, headline/domains/pending/stable sections all display correctly.

**Step 6: Commit**

```bash
git add src/components/briefing/ src/services/signal/ src/App.tsx
git commit -m "feat: Briefing Mode v0.3 — ICU patient signal briefing with time window selector"
```

---

## v0.4 — Chat Mode (Chart-Grounded)

**What it does:** The clinician asks natural language questions about the patient. The AI answers using only the patient's chart data (from the Signal Engine context object), with every answer cited to a specific FHIR resource and timestamp. No hallucination — if the data isn't in the chart, the AI says so.

---

### Task 7: Upgrade ChatInterface to chart-grounded, cited mode

**Files:**
- Modify: `backend/src/routes/ai.ts` (upgrade `/chat` endpoint)
- Modify: `backend/src/services/ai/aiService.ts` (inject Signal context)
- Modify: `src/components/chat/ChatInterface.tsx` (add citations UI)

**Step 1: Upgrade backend chat endpoint to inject timeline context**

```typescript
// In backend/src/routes/ai.ts — upgrade POST /chat handler:
router.post('/chat', async (req: Request, res: Response) => {
  const { message, patientData } = req.body;
  const sessionId = req.headers['x-session-id'] as string || req.headers['x-patient-id'] as string || '';

  // Get cached timeline if available
  const { contextStore } = require('../services/signal/contextStore');
  const cached = contextStore.get(sessionId);

  let systemPrompt = `You are a critical care physician AI assistant. Answer questions about this specific patient using ONLY the data provided.
For every fact you state, cite the source with format [Source: <label>, <timestamp>].
If the data does not contain the answer, say "This information is not in the available chart data."
Be concise and clinically precise. Do not speculate.`;

  let context = '';
  if (cached?.timeline) {
    const recentEvents = cached.timeline.events.slice(0, 200);
    context = recentEvents.map((e: any) =>
      `[${e.timestamp}] ${e.type.toUpperCase()} | ${e.label}: ${e.value ?? ''} ${e.unit ?? ''}`
    ).join('\n');
    systemPrompt += `\n\nPATIENT CHART DATA:\n${context}`;
  } else if (patientData) {
    // If no cached context, use raw patient data summary
    systemPrompt += `\n\nPATIENT DATA: ${JSON.stringify(patientData).slice(0, 8000)}`;
  }

  const response = await aiService.chat(message, systemPrompt);
  res.json({ response, cited: true });
});
```

**Step 2: Add citation rendering to ChatInterface.tsx**

Update the message rendering in `ChatInterface.tsx` to parse `[Source: ...]` tags and display them as styled citation chips below each AI response:

```typescript
// Add this utility to ChatInterface.tsx:
const renderWithCitations = (text: string) => {
  const parts = text.split(/(\[Source:[^\]]+\])/g);
  return parts.map((part, i) => {
    if (part.startsWith('[Source:')) {
      return (
        <span key={i} className="inline-block text-xs bg-blue-100 text-blue-700 rounded px-1.5 py-0.5 ml-1 font-mono">
          {part}
        </span>
      );
    }
    return <span key={i}>{part}</span>;
  });
};
```

**Step 3: Commit**

```bash
git add backend/src/routes/ai.ts src/components/chat/ChatInterface.tsx
git commit -m "feat: Chat Mode v0.4 — chart-grounded cited responses using Signal Engine context"
```

---

## v0.5 — Co-Writer Mode

**What it does:** Clinician selects a note type (Progress Note, H&P, Transfer Note, etc.). The AI reads the Signal Engine context and pre-populates every section of the note with synthesized, chart-grounded content. Each sentence is traceable to a source data point. Clinician edits, not writes from scratch.

---

### Task 8: Build Co-Writer backend endpoint

**Files:**
- Create: `backend/src/services/cowriter/noteBuilder.ts`
- Modify: `backend/src/routes/ai.ts` (upgrade `/generate-document`)

**Step 1: Build note section prompts per note type**

```typescript
// backend/src/services/cowriter/noteBuilder.ts
export const NOTE_SECTION_PROMPTS: Record<string, string[]> = {
  'Progress Note': ['Subjective', 'Objective', 'Assessment', 'Plan'],
  'H&P': ['Chief Complaint', 'History of Present Illness', 'Past Medical History', 'Medications', 'Allergies', 'Review of Systems', 'Physical Exam', 'Assessment', 'Plan'],
  'Transfer Note': ['Reason for Transfer', 'Hospital Course', 'Current Clinical Status', 'Active Problems', 'Current Medications', 'Pending Items', 'Disposition'],
  'Accept Note': ['Reason for Consultation', 'Pertinent History', 'Current Data Review', 'Assessment', 'Recommendations'],
  'Consult Note': ['Reason for Consultation', 'History', 'Relevant Data', 'Assessment', 'Recommendations'],
  'Discharge Summary': ['Admission Diagnosis', 'Hospital Course', 'Discharge Diagnosis', 'Discharge Condition', 'Discharge Medications', 'Follow-up Instructions'],
};

export function buildCoWriterPrompt(noteType: string, timelineData: string, additionalContext?: string): string {
  const sections = NOTE_SECTION_PROMPTS[noteType] || NOTE_SECTION_PROMPTS['Progress Note'];
  return `You are a critical care physician AI assistant writing a ${noteType}.

Generate each section using ONLY the patient chart data provided below.
For each factual claim, append a brief citation: [Lab: <name> <value> <timestamp>] or [Vital: <name> <value> <timestamp>] or [Note: <type> <timestamp>].
Write in standard medical prose. Be clinically precise and concise.
If a section lacks sufficient data, write "Insufficient data available" for that section.

REQUIRED SECTIONS: ${sections.join(', ')}

PATIENT CHART DATA:
${timelineData}

${additionalContext ? `ADDITIONAL CLINICIAN CONTEXT:\n${additionalContext}` : ''}

Return JSON with this structure:
{
  "noteType": "${noteType}",
  "sections": [
    { "name": "Section Name", "content": "Section text with inline citations", "sources": ["source1", "source2"] }
  ],
  "generatedAt": "<ISO timestamp>"
}`;
}
```

**Step 2: Upgrade generate-document endpoint**

```typescript
// In backend/src/routes/ai.ts — upgrade POST /generate-document:
router.post('/generate-document', async (req: Request, res: Response) => {
  const { template, context: additionalContext, patientData } = req.body;
  const sessionId = req.headers['x-session-id'] as string || req.headers['x-patient-id'] as string || '';

  const { contextStore } = require('../services/signal/contextStore');
  const { buildCoWriterPrompt } = require('../services/cowriter/noteBuilder');

  const cached = contextStore.get(sessionId);
  let timelineData = '';
  if (cached?.timeline) {
    timelineData = cached.timeline.events.slice(0, 300).map((e: any) =>
      `[${e.timestamp}] ${e.type.toUpperCase()} | ${e.label}: ${e.value ?? ''} ${e.unit ?? ''}`
    ).join('\n');
  } else if (patientData) {
    timelineData = JSON.stringify(patientData).slice(0, 10000);
  }

  const prompt = buildCoWriterPrompt(template, timelineData, additionalContext);

  const response = await aiService.chat(prompt, 'You are a clinical documentation AI. Return only valid JSON.');
  let parsed;
  try { parsed = JSON.parse(response); }
  catch { parsed = { sections: [{ name: 'Note', content: response, sources: [] }] }; }

  res.json({ document: parsed, noteType: template });
});
```

**Step 3: Build Co-Writer frontend panel**

```typescript
// src/components/cowriter/CoWriterPanel.tsx
import React, { useState } from 'react';

const NOTE_TYPES = ['Progress Note', 'H&P', 'Transfer Note', 'Accept Note', 'Consult Note', 'Discharge Summary'];

export const CoWriterPanel: React.FC = () => {
  const [noteType, setNoteType] = useState('Progress Note');
  const [additionalContext, setAdditionalContext] = useState('');
  const [document, setDocument] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [editedSections, setEditedSections] = useState<Record<string, string>>({});

  const generate = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/ai/generate-document`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Patient-Id': sessionStorage.getItem('patientId') || '' },
        body: JSON.stringify({ template: noteType, context: additionalContext }),
      });
      const data = await res.json();
      setDocument(data.document);
      // Initialize edited sections from generated content
      const initial: Record<string, string> = {};
      data.document?.sections?.forEach((s: any) => { initial[s.name] = s.content; });
      setEditedSections(initial);
    } finally {
      setLoading(false);
    }
  };

  const copyAll = () => {
    const fullNote = document?.sections?.map((s: any) =>
      `${s.name.toUpperCase()}\n${editedSections[s.name] || s.content}`
    ).join('\n\n');
    navigator.clipboard.writeText(fullNote || '');
  };

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center gap-3 flex-wrap">
        <select value={noteType} onChange={e => setNoteType(e.target.value)} className="border rounded px-2 py-1 text-sm">
          {NOTE_TYPES.map(t => <option key={t}>{t}</option>)}
        </select>
        <button onClick={generate} disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50">
          {loading ? 'Generating...' : 'Generate Note'}
        </button>
        {document && <button onClick={copyAll} className="px-4 py-2 bg-green-600 text-white rounded text-sm hover:bg-green-700">Copy All</button>}
      </div>

      <textarea
        value={additionalContext}
        onChange={e => setAdditionalContext(e.target.value)}
        placeholder="Optional: add exam findings, verbal context, or clinical reasoning not in the chart..."
        className="border rounded p-2 text-sm h-20 resize-none"
      />

      {document?.sections?.map((section: any) => (
        <div key={section.name} className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">{section.name}</label>
            {section.sources?.length > 0 && (
              <span className="text-xs text-blue-500">{section.sources.length} sources</span>
            )}
          </div>
          <textarea
            value={editedSections[section.name] ?? section.content}
            onChange={e => setEditedSections(prev => ({ ...prev, [section.name]: e.target.value }))}
            className="w-full border border-gray-200 rounded p-2 text-sm font-mono resize-none min-h-[80px]"
            rows={Math.max(3, Math.ceil((editedSections[section.name] || section.content || '').length / 80))}
          />
        </div>
      ))}
    </div>
  );
};
```

**Step 4: Add Co-Writer tab to App.tsx**

**Step 5: Manual test end-to-end**

```bash
npm run dev
```
Test: Select note type → Generate → verify all sections populate → edit a section → Copy All → paste into a text editor and verify formatting.

**Step 6: Commit**

```bash
git add src/components/cowriter/ backend/src/services/cowriter/ backend/src/routes/ai.ts
git commit -m "feat: Co-Writer Mode v0.5 — chart-grounded note generation with editable sections"
```

---

## v0.6 — Population Query Layer (Scaffold Only)

**What it does:** Adds the architectural hooks for the future population query engine without building the UI or full query logic. This ensures the data models and API namespaces are designed correctly from day one.

---

### Task 9: Scaffold population layer

**Files:**
- Create: `backend/src/routes/population.ts` (stub)
- Create: `backend/src/services/population/populationQueryEngine.ts` (stub)
- Modify: `backend/src/server.ts`

**Step 1: Create stub population route**

```typescript
// backend/src/routes/population.ts
import { Router, Request, Response } from 'express';

const router = Router();

/**
 * POPULATION QUERY ENGINE — v1.0 ROADMAP
 *
 * This service will accept natural language queries against the hospital's
 * full FHIR dataset (via FHIR Bulk API $export) and return structured
 * statistical reports for:
 *
 * - Quality/Safety Officers: VAP rates, sepsis bundle compliance, etc.
 * - Infection Control: MRSA/CLABSI/CDiff trends over time
 * - Clinical Researchers: cohort queries, population-level statistics
 * - Administration/Compliance: regulatory reporting, accreditation metrics
 *
 * Architecture:
 * - Natural language → structured FHIR query (LLM translation)
 * - FHIR Bulk API $export → async job queue
 * - Statistical analysis (mean, median, trend, rate per 1000 patient-days)
 * - Role-based output formatting (report, chart, export)
 */

router.post('/query', (_req: Request, res: Response) => {
  res.status(501).json({
    error: 'Population Query Engine not yet implemented',
    roadmap: 'v1.0 — Q4 2026',
    plannedCapabilities: [
      'Natural language → FHIR bulk query translation',
      'Infection control metrics (MRSA, CLABSI, VAP, CDiff)',
      'Sepsis bundle compliance tracking',
      'Quality measure reporting (CMS, NHSN)',
      'Cohort-level clinical research queries',
      'Role-based access control (quality, research, admin)',
    ],
  });
});

export default router;
```

**Step 2: Create stub population service**

```typescript
// backend/src/services/population/populationQueryEngine.ts

/**
 * Population Query Engine
 *
 * ARCHITECTURE (for v1.0 implementation):
 *
 * 1. NLQ Translator: natural language → FHIRPath/FHIR search parameters (via LLM)
 * 2. Bulk Exporter: FHIR $export API → async ndjson download → parse
 * 3. Cohort Builder: filter patients by criteria (diagnosis, date range, unit, etc.)
 * 4. Stats Engine: count, rate per 1000 patient-days, trend analysis, chi-square
 * 5. Report Generator: format by role (quality dashboard, compliance report, research table)
 *
 * FHIR Resources needed:
 * - Patient (demographics, identifiers)
 * - Condition (diagnoses — HAI identification)
 * - Observation (labs — culture results for MRSA/CLABSI)
 * - Encounter (admission/discharge dates, unit, length of stay)
 * - Procedure (line placements — CLABSI denominator)
 * - DiagnosticReport (microbiology reports)
 *
 * QUERY SCOPE ISOLATION:
 * - Patient-level queries: per-patient FHIR REST API (already built in SignalEngine)
 * - Population queries: FHIR Bulk API ($export) — requires server-level OAuth (backend-to-EHR)
 * - These are architecturally separate; only the FhirNormalizer is shared
 */

export class PopulationQueryEngine {
  // v1.0 implementation placeholder
  async query(_naturalLanguageQuery: string, _role: 'quality' | 'research' | 'admin'): Promise<never> {
    throw new Error('Not implemented — see v1.0 roadmap');
  }
}
```

**Step 3: Register population route**

```typescript
// backend/src/server.ts — add:
import populationRouter from './routes/population';
app.use('/api/population', populationRouter);
```

**Step 4: Commit**

```bash
git add backend/src/routes/population.ts backend/src/services/population/ backend/src/server.ts
git commit -m "scaffold: population query engine hooks and architecture comments for v1.0"
```

---

## Build Sequence Summary

| Version | Feature | Timeline | Price Tier Unlocked |
|---|---|---|---|
| v0.1 | Scribe (audio → transcribe → note) | Weeks 1–6 | $19/month |
| v0.2 | Signal Engine (FHIR → timeline → signal) | Weeks 7–14 | — |
| v0.3 | Briefing Mode (proactive patient briefing) | Weeks 15–18 | $49/month |
| v0.4 | Chat Mode (cited chart-grounded Q&A) | Weeks 19–22 | $49/month |
| v0.5 | Co-Writer Mode (note type → AI sections → edit) | Weeks 23–30 | $49/month |
| v0.6 | Population Scaffold | Weeks 31–32 | — |
| v1.0 | Epic FHIR adapter | Weeks 33–40 | Enterprise |
| v1.1 | Population Query Engine (full) | Weeks 41–52 | Enterprise |

---

## Testing Strategy

Every task follows TDD. For each feature:
- Unit tests for pure functions (normalizer, extractor, builder)
- Integration tests for API routes (supertest)
- Component tests for React UI (vitest + testing-library)
- Manual E2E test against Cerner sandbox or mock data

Run all tests before every commit:
```bash
# Frontend
npx vitest run

# Backend
cd backend && npx jest --no-coverage
```

---

## Environment Variables to Add

```env
# Backend
OPENAI_MODEL=gpt-4o
REDIS_URL=redis://localhost:6379   # for production context store
SIGNAL_CACHE_TTL_MINUTES=15

# Frontend
VITE_ENABLE_SCRIBE=true
VITE_ENABLE_BRIEFING=true
VITE_ENABLE_CHAT=true
VITE_ENABLE_COWRITER=true
```

---

## Key Architectural Decisions

1. **Context Store is in-memory for v0.x, Redis for production** — swap by changing `contextStore.ts` implementation only
2. **Signal Engine runs on the backend** — keeps PHI processing server-side, consistent with existing audit/PHI middleware
3. **All three modes share one context object** — the engine runs once per session, all modes read from cache
4. **Population layer is a separate service** — different OAuth scope (backend-to-EHR bulk), different data pipeline, shared FHIR normalizer only
5. **Feature flags per tier** — `VITE_ENABLE_*` flags allow disabling Signal/Briefing/Chat/CoWriter for Scribe-tier users
