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
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

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
      setIsRecording(true);
      timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Microphone access failed';
      onError?.(message);
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    if (timerRef.current) clearInterval(timerRef.current);
    setIsRecording(false);
    setDuration(0);
  };

  const handleRecordingStop = async (stream: MediaStream) => {
    stream.getTracks().forEach((t) => t.stop());
    const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
    const formData = new FormData();
    formData.append('audio', blob, 'recording.webm');
    try {
      const backendUrl = typeof import.meta !== 'undefined' && import.meta.env
        ? (import.meta.env.VITE_BACKEND_URL ?? '')
        : '';
      const res = await fetch(`${backendUrl}/api/ai/transcribe`, {
        method: 'POST',
        body: formData,
        headers: { 'X-Patient-Id': sessionStorage.getItem('patientId') ?? '' },
      });
      const data = await res.json() as { transcript?: string; error?: string };
      if (data.transcript) {
        onTranscript(data.transcript);
      } else {
        onError?.(data.error ?? 'Transcription failed');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Transcription request failed';
      onError?.(message);
    }
  };

  const formatDuration = (s: number) =>
    `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

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
          isRecording ? 'bg-red-500 hover:bg-red-600' : 'bg-blue-600 hover:bg-blue-700'
        }`}
      >
        {isRecording ? 'Stop' : 'Record'}
      </button>
    </div>
  );
};
