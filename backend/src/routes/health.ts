import { Router, Request, Response } from 'express';

const router = Router();

router.get('/health', async (_req: Request, res: Response) => {
  const analyzerUrl = process.env.PRESIDIO_ANALYZER_URL || 'http://localhost:5002';
  const anonymizerUrl = process.env.PRESIDIO_ANONYMIZER_URL || 'http://localhost:5001';
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

  const [analyzer, anonymizer] = await Promise.all([
    checkService(analyzerUrl),
    checkService(anonymizerUrl),
  ]);

  const presidio = analyzer === 'ok' && anonymizer === 'ok' ? 'healthy' : 'degraded';

  res.json({ presidio, analyzer, anonymizer });
});

export default router;
