import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AudioRecorder } from '../scribe/AudioRecorder';
import { useScribeBuilderStore } from '../../stores/scribeBuilderStore';
import { getBackendUrl } from '../../config/appConfig';

type Phase = 'record' | 'generating' | 'error';

export const ScribeRecordPage: React.FC = () => {
  const { id: noteId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { canvasSections, noteType } = useScribeBuilderStore();
  const [phase, setPhase] = useState<Phase>('record');
  const [error, setError] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState('');

  const handleTranscript = async (transcript: string) => {
    setPhase('generating');
    setStatusMsg('Generating note sections...');
    try {
      await fetch(`${getBackendUrl()}/api/scribe/notes/${noteId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ transcript }),
      });

      const genRes = await fetch(`${getBackendUrl()}/api/ai/scribe/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          transcript,
          sections: canvasSections.map(s => ({ name: s.name, promptHint: s.promptHint || '' })),
          noteType,
        }),
      });
      const genData = await genRes.json();
      if (!genRes.ok) throw new Error(genData.error || 'Generation failed');

      await fetch(`${getBackendUrl()}/api/scribe/notes/${noteId}/sections`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ sections: genData.sections }),
      });

      navigate(`/scribe/note/${noteId}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'An unexpected error occurred');
      setPhase('error');
    }
  };

  const handleError = (msg: string) => {
    setError(msg);
    setPhase('error');
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-64 gap-6 py-12">
      {phase === 'record' && (
        <>
          <h1 className="text-xl font-bold text-gray-900">Ready to Record</h1>
          <p className="text-sm text-gray-500 text-center max-w-xs">
            Speak your patient encounter. The AI will generate all {canvasSections.length} section{canvasSections.length !== 1 ? 's' : ''} automatically.
          </p>
          <AudioRecorder onTranscript={handleTranscript} onError={handleError} />
        </>
      )}

      {phase === 'generating' && (
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin h-10 w-10 border-4 border-blue-500 border-t-transparent rounded-full" />
          <p className="text-sm text-gray-600 animate-pulse">{statusMsg || 'Processing...'}</p>
        </div>
      )}

      {phase === 'error' && (
        <div className="text-center">
          <p className="text-red-600 text-sm mb-4">{error}</p>
          <button
            onClick={() => { setPhase('record'); setError(null); }}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
          >
            Try again
          </button>
        </div>
      )}
    </div>
  );
};
