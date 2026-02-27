export class WhisperService {
  async transcribe(audioBuffer: Buffer, mimeType: string): Promise<string> {
    if (!audioBuffer || audioBuffer.length === 0) {
      throw new Error('Empty audio buffer');
    }

    const baseUrl = (process.env.WHISPER_API_URL || '').trim().replace(/\/+$/, '');
    if (!baseUrl) {
      throw new Error('WHISPER_API_URL is required — self-hosted Whisper must be configured');
    }

    return this.callSelfHosted(audioBuffer, mimeType, baseUrl);
  }

  /**
   * Call the self-hosted Whisper ASR container (onerahmet/openai-whisper-asr-webservice).
   * Endpoint: POST /asr?task=transcribe&language=en&output=json
   */
  private async callSelfHosted(audioBuffer: Buffer, mimeType: string, baseUrl: string): Promise<string> {
    const timeoutMs = parseInt(process.env.WHISPER_TIMEOUT_MS || '120000', 10);
    const ext = mimeType.includes('webm') ? 'webm' : mimeType.includes('mp4') ? 'mp4' : 'wav';

    const form = new FormData();
    form.append(
      'audio_file',
      new Blob([audioBuffer], { type: mimeType }),
      `recording.${ext}`,
    );

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(
        `${baseUrl}/asr?task=transcribe&language=en&output=json`,
        { method: 'POST', body: form, signal: controller.signal },
      );

      if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new Error(`Whisper ASR returned ${response.status}: ${body}`);
      }

      const result = (await response.json()) as { text: string };
      return result.text;
    } finally {
      clearTimeout(timer);
    }
  }
}
