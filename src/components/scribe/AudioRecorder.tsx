import React, { useEffect, useRef, useState } from 'react';
import { useScribeStore } from '../../stores/scribeStore';
import { getBackendUrl } from '../../config/appConfig';

interface Props {
  onTranscript: (transcript: string) => void;
  onError?: (error: string) => void;
}

export const AudioRecorder: React.FC<Props> = ({ onTranscript, onError }) => {
  // Fix 5: Use store as single source of truth for isRecording
  const isRecording = useScribeStore((s) => s.isRecording);
  const setRecording = useScribeStore((s) => s.setRecording);
  const isTranscribing = useScribeStore((s) => s.isTranscribing);
  const setTranscribing = useScribeStore((s) => s.setTranscribing);

  // Fix 2: Guard against double-click race condition
  const [isStarting, setIsStarting] = useState(false);

  const [duration, setDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Fix 1: Hold a ref to the active stream for cleanup on unmount
  const streamRef = useRef<MediaStream | null>(null);

  // Fix 1: Cleanup on unmount — stop recorder, clear timer, stop stream tracks
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  const startRecording = async () => {
    // Fix 2: Guard against double-click / re-entrant calls
    if (isStarting || isRecording) return;
    setIsStarting(true);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Fix 1: Store stream in ref so the cleanup effect can reach it
      streamRef.current = stream;

      // Determine a supported mimeType — jsdom/test environments may not support any
      const preferredTypes = ['audio/webm', 'audio/ogg', ''];
      const mimeType = preferredTypes.find(
        (t) => t === '' || (typeof MediaRecorder.isTypeSupported === 'function' && MediaRecorder.isTypeSupported(t))
      ) ?? '';

      const recorderOptions = mimeType ? { mimeType } : undefined;
      const recorder = new MediaRecorder(stream, recorderOptions);

      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => handleRecordingStop(stream);
      recorder.start(1000);
      mediaRecorderRef.current = recorder;
      // Fix 5: Use store setter instead of local useState
      setRecording(true);
      timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
    } catch (err) {
      let message = err instanceof Error ? err.message : 'Microphone access failed';
      if (err instanceof DOMException) {
        if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
          message = 'No microphone found. Please connect a microphone and try again.';
        } else if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          message = 'Microphone permission denied. Please allow microphone access in your browser settings.';
        } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
          message = 'Microphone is in use by another application. Please close other apps using the mic and try again.';
        }
      }
      onError?.(message);
    } finally {
      // Fix 2: Always clear the starting guard
      setIsStarting(false);
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    if (timerRef.current) clearInterval(timerRef.current);
    // Fix 5: Use store setter
    setRecording(false);
    setDuration(0);
  };

  const handleRecordingStop = async (stream: MediaStream) => {
    stream.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
    const formData = new FormData();
    formData.append('audio', blob, 'recording.webm');

    // Fix 3: Signal that transcription is in progress
    setTranscribing(true);
    try {
      const res = await fetch(`${getBackendUrl()}/api/ai/transcribe`, {
        method: 'POST',
        body: formData,
        headers: { 'X-Patient-Id': sessionStorage.getItem('patientId') ?? '' },
      });

      // Fix 4: Check res.ok before parsing body
      if (!res.ok) {
        let serverMessage: string;
        try {
          const errData = await res.json() as { error?: string };
          serverMessage = errData.error ?? `Server error: ${res.status}`;
        } catch {
          serverMessage = `Server error: ${res.status}`;
        }
        onError?.(serverMessage);
        return;
      }

      const data = await res.json() as { transcript?: string; error?: string };
      if (data.transcript) {
        onTranscript(data.transcript);
      } else {
        onError?.(data.error ?? 'Transcription failed');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Transcription request failed';
      onError?.(message);
    } finally {
      // Fix 3: Clear transcribing state regardless of outcome
      setTranscribing(false);
    }
  };

  const formatDuration = (s: number) =>
    `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  // Fix 2 & 3: Button is disabled while starting or transcribing
  const buttonDisabled = isStarting || isTranscribing;

  return (
    <div className="flex flex-col items-center gap-3">
      {isRecording && (
        <div className="flex items-center gap-2 text-red-500 font-mono text-sm">
          <span className="animate-pulse h-2 w-2 rounded-full bg-red-500" />
          Recording {formatDuration(duration)}
        </div>
      )}
      {/* Fix 3: Show transcribing feedback */}
      {isTranscribing && (
        <div className="flex items-center gap-2 text-blue-500 font-mono text-sm">
          <span className="animate-pulse h-2 w-2 rounded-full bg-blue-500" />
          Transcribing...
        </div>
      )}
      <button
        onClick={isRecording ? stopRecording : startRecording}
        disabled={buttonDisabled}
        className={`px-6 py-3 rounded-full font-semibold text-white transition-all ${
          isRecording
            ? 'bg-red-500 hover:bg-red-600'
            : buttonDisabled
            ? 'bg-blue-400 cursor-not-allowed'
            : 'bg-blue-600 hover:bg-blue-700'
        }`}
      >
        {isStarting ? 'Starting...' : isRecording ? 'Stop' : 'Record'}
      </button>
    </div>
  );
};
