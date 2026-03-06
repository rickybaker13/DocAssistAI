import React, { useEffect, useRef, useState } from 'react';
import { useScribeStore } from '../../stores/scribeStore';
import { getBackendUrl } from '../../config/appConfig';
import { BackgroundKeepAlive } from '../../utils/backgroundKeepAlive';

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
  const keepAliveRef = useRef<BackgroundKeepAlive | null>(null);

  // iOS interruption tracking
  const [interruptions, setInterruptions] = useState<{ gapSeconds: number }[]>([]);
  const [interruptionDismissed, setInterruptionDismissed] = useState(false);
  const hiddenAtRef = useRef<number | null>(null);
  const isResumingRef = useRef(false);
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

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
      keepAliveRef.current?.stop();
      keepAliveRef.current = null;
    };
  }, []);

  // --- iOS background interruption handling ---
  // When the page goes hidden (user switches apps), pause the timer.
  // When it comes back visible, check if MediaRecorder survived. If not,
  // auto-resume with a fresh stream and show an interruption warning.
  useEffect(() => {
    if (!isRecording) return;

    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'hidden') {
        hiddenAtRef.current = Date.now();
        // Pause duration timer while backgrounded
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
      } else if (document.visibilityState === 'visible') {
        // Calculate how long we were hidden
        const gapMs = hiddenAtRef.current ? Date.now() - hiddenAtRef.current : 0;
        const gapSeconds = Math.round(gapMs / 1000);
        hiddenAtRef.current = null;

        // Resume duration timer
        if (!timerRef.current) {
          timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
        }

        const recorder = mediaRecorderRef.current;
        if (recorder && recorder.state === 'recording') {
          // MediaRecorder survived (e.g. lock screen). Just restart keep-alive.
          await keepAliveRef.current?.restart();
          return;
        }

        // --- MediaRecorder was killed by iOS (app-switch case) ---
        if (isResumingRef.current) return;
        isResumingRef.current = true;

        try {
          // Record the interruption for the UI warning
          if (gapSeconds > 0) {
            setInterruptions((prev) => [...prev, { gapSeconds }]);
            setInterruptionDismissed(false);
          }

          // Get a fresh mic stream
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          streamRef.current?.getTracks().forEach((t) => t.stop());
          streamRef.current = stream;

          // Determine supported mimeType (same logic as startRecording)
          const preferredTypes = ['audio/webm', 'audio/ogg', ''];
          const mimeType =
            preferredTypes.find(
              (t) =>
                t === '' ||
                (typeof MediaRecorder.isTypeSupported === 'function' &&
                  MediaRecorder.isTypeSupported(t))
            ) ?? '';
          const recorderOptions = mimeType ? { mimeType } : undefined;

          // Create new recorder — DO NOT clear chunksRef (preserve previous audio)
          const newRecorder = new MediaRecorder(stream, recorderOptions);
          newRecorder.ondataavailable = (e) => {
            if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
          };
          newRecorder.onstop = () => handleRecordingStop(stream);
          newRecorder.start(1000);
          mediaRecorderRef.current = newRecorder;

          // Restart background keep-alive
          await keepAliveRef.current?.restart();
        } catch (err) {
          // getUserMedia failed on resume (permission revoked, etc.)
          const message = err instanceof Error ? err.message : 'Failed to resume recording';
          onErrorRef.current?.(`Recording interrupted: ${message}. Your previous audio is preserved.`);
        } finally {
          isResumingRef.current = false;
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isRecording]); // eslint-disable-line react-hooks/exhaustive-deps

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

      // Activate iOS background keep-alive (silent audio + wake lock).
      // Must be called within user-gesture call stack so iOS allows audio.play().
      const keepAlive = new BackgroundKeepAlive();
      keepAliveRef.current = keepAlive;
      await keepAlive.start();

      const recorder = new MediaRecorder(stream, recorderOptions);

      chunksRef.current = [];
      setInterruptions([]);
      setInterruptionDismissed(false);
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
      // Clean up keep-alive if recording setup fails after it was started
      keepAliveRef.current?.stop();
      keepAliveRef.current = null;

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
    hiddenAtRef.current = null;
    keepAliveRef.current?.stop();
    keepAliveRef.current = null;
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

  const totalGapSeconds = interruptions.reduce((sum, i) => sum + i.gapSeconds, 0);

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Interruption warning banner */}
      {isRecording && interruptions.length > 0 && !interruptionDismissed && (
        <div className="flex items-start gap-2 text-amber-400 bg-amber-950/50 border border-amber-400/20 rounded-lg p-2.5 text-xs max-w-xs">
          <span className="shrink-0 mt-0.5">&#9888;</span>
          <div className="flex-1">
            <p className="font-medium">Recording interrupted</p>
            <p className="text-amber-400/80 mt-0.5">
              {interruptions.length === 1
                ? `Paused for ~${interruptions[0].gapSeconds}s while app was in background. Audio during that time was not captured.`
                : `${interruptions.length} interruptions totaling ~${totalGapSeconds}s. Audio during those gaps was not captured.`}
            </p>
          </div>
          <button
            onClick={() => setInterruptionDismissed(true)}
            className="shrink-0 text-amber-400/60 hover:text-amber-400"
            aria-label="Dismiss interruption warning"
          >
            &#x2715;
          </button>
        </div>
      )}

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
