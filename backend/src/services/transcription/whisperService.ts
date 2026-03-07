export class WhisperService {
  async transcribe(audioBuffer: Buffer, mimeType: string): Promise<string> {
    if (!audioBuffer || audioBuffer.length === 0) {
      throw new Error('Empty audio buffer');
    }

    // Prefer Groq cloud API if configured (much faster than self-hosted)
    const groqKey = (process.env.GROQ_API_KEY || '').trim();
    if (groqKey) {
      const start = Date.now();
      console.log('[Whisper] Using Groq cloud API');
      const text = await this.callGroq(audioBuffer, mimeType, groqKey);
      console.log(`[Whisper] Groq transcription completed in ${Date.now() - start}ms`);
      return text;
    }

    // Fall back to self-hosted Whisper
    const baseUrl = (process.env.WHISPER_API_URL || '').trim().replace(/\/+$/, '');
    if (!baseUrl) {
      throw new Error('WHISPER_API_URL is required — self-hosted Whisper must be configured');
    }

    const start = Date.now();
    console.log('[Whisper] Using self-hosted Whisper at', baseUrl);
    const text = await this.callSelfHosted(audioBuffer, mimeType, baseUrl);
    console.log(`[Whisper] Self-hosted transcription completed in ${Date.now() - start}ms`);
    return text;
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

  /**
   * Call Groq's OpenAI-compatible Whisper API.
   * Much faster than self-hosted (~2-3s vs ~15-25s for typical recordings).
   */
  private async callGroq(audioBuffer: Buffer, mimeType: string, apiKey: string): Promise<string> {
    const model = process.env.GROQ_WHISPER_MODEL || 'whisper-large-v3-turbo';
    const ext = mimeType.includes('webm') ? 'webm' : mimeType.includes('mp4') ? 'mp4' : 'wav';

    const form = new FormData();
    form.append('file', new Blob([audioBuffer], { type: mimeType }), `recording.${ext}`);
    form.append('model', model);
    form.append('language', 'en');
    form.append('response_format', 'json');

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 60000);

    try {
      const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}` },
        body: form,
        signal: controller.signal,
      });

      if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new Error(`Groq Whisper returned ${response.status}: ${body}`);
      }

      const result = (await response.json()) as { text: string };
      return result.text;
    } finally {
      clearTimeout(timer);
    }
  }
}
