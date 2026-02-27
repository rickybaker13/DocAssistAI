import { Router, Request, Response } from 'express';

const router = Router();

router.get('/health', async (_req: Request, res: Response) => {
  const analyzerUrl = process.env.PRESIDIO_ANALYZER_URL || 'http://localhost:5002';
  const anonymizerUrl = process.env.PRESIDIO_ANONYMIZER_URL || 'http://localhost:5001';
  const whisperUrl = process.env.WHISPER_API_URL || '';
  const timeoutMs = 3000;

  async function checkService(url: string): Promise<'ok' | 'unavailable'> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const resp = await fetch(`${url}/health`, { signal: controller.signal });
      return resp.ok ? 'ok' : 'unavailable';
    } catch {
      return 'unavailable';
    } finally {
      clearTimeout(timer);
    }
  }

  async function checkWhisper(url: string): Promise<'ok' | 'unavailable' | 'not_configured'> {
    if (!url) return 'not_configured';
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const resp = await fetch(url.replace(/\/+$/, '') + '/', { signal: controller.signal });
      return resp.ok ? 'ok' : 'unavailable';
    } catch {
      return 'unavailable';
    } finally {
      clearTimeout(timer);
    }
  }

  const [analyzer, anonymizer, whisper] = await Promise.all([
    checkService(analyzerUrl),
    checkService(anonymizerUrl),
    checkWhisper(whisperUrl),
  ]);

  const presidio = analyzer === 'ok' && anonymizer === 'ok' ? 'healthy' : 'degraded';

  res.json({ presidio, analyzer, anonymizer, whisper });
});

export default router;
