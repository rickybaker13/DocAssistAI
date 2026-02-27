import { Router, Request, Response } from 'express';

const router = Router();

router.get('/health', async (_req: Request, res: Response) => {
  const analyzerUrl = process.env.PRESIDIO_ANALYZER_URL || 'http://localhost:5002';
  const anonymizerUrl = process.env.PRESIDIO_ANONYMIZER_URL || 'http://localhost:5001';
  const whisperUrl = process.env.WHISPER_API_URL || '';
  const timeoutMs = 3000;

  async function checkService(url: string): Promise<{ status: 'ok' | 'unavailable'; error?: string }> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const resp = await fetch(`${url}/health`, { signal: controller.signal });
      return resp.ok ? { status: 'ok' } : { status: 'unavailable', error: `HTTP ${resp.status}` };
    } catch (err: any) {
      const msg = err?.cause?.code || err?.code || err?.message || 'unknown';
      return { status: 'unavailable', error: msg };
    } finally {
      clearTimeout(timer);
    }
  }

  async function checkWhisper(url: string): Promise<{ status: 'ok' | 'unavailable' | 'not_configured'; error?: string }> {
    if (!url) return { status: 'not_configured' };
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const resp = await fetch(url.replace(/\/+$/, '') + '/', { signal: controller.signal });
      return resp.ok ? { status: 'ok' } : { status: 'unavailable', error: `HTTP ${resp.status}` };
    } catch (err: any) {
      const msg = err?.cause?.code || err?.code || err?.message || 'unknown';
      return { status: 'unavailable', error: msg };
    } finally {
      clearTimeout(timer);
    }
  }

  const [analyzer, anonymizer, whisper] = await Promise.all([
    checkService(analyzerUrl),
    checkService(anonymizerUrl),
    checkWhisper(whisperUrl),
  ]);

  const presidio = analyzer.status === 'ok' && anonymizer.status === 'ok' ? 'healthy' : 'degraded';

  res.json({
    presidio,
    analyzer: analyzer.status,
    anonymizer: anonymizer.status,
    whisper: whisper.status,
    // Include error details only when something is wrong (helps debug connectivity)
    ...(analyzer.error && { analyzerError: analyzer.error }),
    ...(anonymizer.error && { anonymizerError: anonymizer.error }),
    ...(whisper.error && { whisperError: whisper.error }),
  });
});

export default router;
