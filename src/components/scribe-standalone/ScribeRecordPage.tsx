import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AudioRecorder } from '../scribe/AudioRecorder';
import { useScribeBuilderStore } from '../../stores/scribeBuilderStore';
import { useScribeNoteStore } from '../../stores/scribeNoteStore';
import { getBackendUrl } from '../../config/appConfig';
import { isIosDevice } from '../../utils/isIosDevice';

type Phase = 'record' | 'error';

export const ScribeRecordPage: React.FC = () => {
  const { id: noteId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { canvasSections, noteType, patientLabel, verbosity } = useScribeBuilderStore();
  const { enqueueEncounter, completeEncounter, failEncounter } = useScribeNoteStore();
  const [phase, setPhase] = useState<Phase>('record');
  const [error, setError] = useState<string | null>(null);

  if (!noteId) return <div className="text-red-400 p-4">Invalid note ID.</div>;

  const handleTranscript = async (transcript: string) => {
    enqueueEncounter({ noteId, noteType, patientLabel, verbosity, transcript });
    navigate('/scribe/dashboard');

    void (async () => {
    try {
      const genRes = await fetch(`${getBackendUrl()}/api/ai/scribe/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          transcript,
          sections: canvasSections.map(s => ({ name: s.name, promptHint: s.promptHint || '' })),
          noteType,
          verbosity,
        }),
      });
      if (!genRes.ok) {
        const genData = await genRes.json().catch(() => ({}));
        throw new Error((genData as any).error || `Note generation failed (${genRes.status})`);
      }
      const genData = await genRes.json();

      // Store generated sections client-side only — never sent to DB
      const sections = (genData.sections || []).map((s: any, i: number) => ({
        id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${i}`,
        section_name: s.name,
        content: s.content || null,
        confidence: s.confidence ?? null,
        display_order: i,
      }));
      completeEncounter(noteId, sections);
    } catch (e: unknown) {
      let msg = 'An unexpected error occurred';
      if (e instanceof TypeError) msg = 'Unable to reach server. Check your connection.';
      else if (e instanceof Error) msg = e.message;
      failEncounter(noteId, msg);
    }
    })();
  };

  const handleError = (msg: string) => {
    setError(msg);
    setPhase('error');
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-64 gap-6 py-12">
      {phase === 'record' && (
        <>
          <h1 className="text-xl font-bold text-slate-100">Ready to Record</h1>
          <p className="text-sm text-slate-400 text-center max-w-xs">
            Speak your patient encounter. The AI will generate all {canvasSections.length} section{canvasSections.length !== 1 ? 's' : ''} automatically.
          </p>
          {isIosDevice() && (
            <p className="text-xs text-amber-400/70 text-center max-w-xs">
              Tip: For uninterrupted recording on iPhone, avoid switching apps. Locking the screen is OK.
            </p>
          )}
          <AudioRecorder onTranscript={handleTranscript} onError={handleError} />
        </>
      )}

      {phase === 'error' && (
        <div className="text-center">
          <p className="text-red-400 text-sm mb-4">{error}</p>
          <button
            onClick={() => { setPhase('record'); setError(null); }}
            className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm hover:bg-teal-500"
          >
            Try again
          </button>
        </div>
      )}
    </div>
  );
};
