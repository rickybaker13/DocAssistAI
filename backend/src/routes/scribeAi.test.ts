import { jest, describe, it, expect, beforeAll, afterEach, afterAll } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import { ScribeUserModel } from '../models/scribeUser';
import { closeDb } from '../database/db';

// In ESM mode, jest.mock at top-level is not hoisted correctly.
// We use jest.spyOn on the singleton aiService object instead,
// matching the pattern used in ai.test.ts.
import { aiService } from '../services/ai/aiService';
import scribeAiRouter from './scribeAi';

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use('/api/ai/scribe', scribeAiRouter);

const SECRET = 'test-secret';
let authCookie: string;
let mockAiChat: ReturnType<typeof jest.spyOn>;

describe('Scribe AI Routes', () => {
  beforeAll(() => {
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = SECRET;
    const user = new ScribeUserModel().create({ email: 'ai-test@test.com', passwordHash: 'hash' });
    const token = jwt.sign({ userId: user.id }, SECRET, { expiresIn: '1h' });
    authCookie = `scribe_token=${token}`;
    mockAiChat = jest.spyOn(aiService, 'chat');
  });
  afterEach(() => {
    mockAiChat.mockReset();
  });
  afterAll(() => {
    jest.restoreAllMocks();
    closeDb();
  });

  describe('POST /generate', () => {
    it('generates sections from transcript', async () => {
      mockAiChat.mockResolvedValueOnce({ content: JSON.stringify({
        sections: [
          { name: 'HPI', content: 'Patient presents with chest pain.', confidence: 0.9 },
          { name: 'Assessment', content: 'Likely ACS.', confidence: 0.85 },
        ],
      }) } as any);

      const res = await request(app)
        .post('/api/ai/scribe/generate')
        .set('Cookie', authCookie)
        .send({
          transcript: 'Patient came in with chest pain for 2 hours.',
          sections: [{ name: 'HPI', promptHint: '' }, { name: 'Assessment', promptHint: '' }],
          noteType: 'progress_note',
        });

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.sections)).toBe(true);
      expect(res.body.sections[0].name).toBe('HPI');
      expect(res.body.sections[0].confidence).toBeDefined();
    });

    it('returns 400 if transcript is missing', async () => {
      const res = await request(app)
        .post('/api/ai/scribe/generate')
        .set('Cookie', authCookie)
        .send({ sections: [{ name: 'HPI' }] });
      expect(res.status).toBe(400);
    });

    it('returns 400 if sections array is empty', async () => {
      const res = await request(app)
        .post('/api/ai/scribe/generate')
        .set('Cookie', authCookie)
        .send({ transcript: 'text', sections: [] });
      expect(res.status).toBe(400);
    });

    it('returns 401 without auth', async () => {
      const res = await request(app).post('/api/ai/scribe/generate').send({ transcript: 'x', sections: [{ name: 'HPI' }] });
      expect(res.status).toBe(401);
    });

    it('POST /generate — accepts verbosity brief without error', async () => {
      mockAiChat.mockResolvedValueOnce({ content: JSON.stringify({
        sections: [
          { name: 'Assessment', content: 'Patient improving.', confidence: 0.9 },
        ],
      }) } as any);

      const res = await request(app)
        .post('/api/ai/scribe/generate')
        .set('Cookie', authCookie)
        .send({
          transcript: 'Patient is feeling better today.',
          sections: [{ name: 'Assessment', promptHint: null }],
          noteType: 'progress_note',
          verbosity: 'brief',
        });
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.sections)).toBe(true);
    });
  });

  describe('POST /focused', () => {
    it('returns focused analysis for a section', async () => {
      mockAiChat.mockResolvedValueOnce({ content: JSON.stringify({
        analysis: 'Deep analysis of the section.',
        citations: [{ guideline: 'Surviving Sepsis Campaign', recommendation: 'Use norepinephrine first-line' }],
        suggestions: ['Consider adding MAP targets'],
        confidence_breakdown: 'Content well-supported',
      }) } as any);

      const res = await request(app)
        .post('/api/ai/scribe/focused')
        .set('Cookie', authCookie)
        .send({
          sectionName: 'Vasopressor Status',
          content: 'Norepinephrine 0.1 mcg/kg/min.',
          transcript: 'Patient on norepinephrine.',
          specialty: 'Critical Care',
        });

      expect(res.status).toBe(200);
      expect(res.body.analysis).toBeDefined();
      expect(Array.isArray(res.body.citations)).toBe(true);
    });
  });

  describe('POST /ghost-write', () => {
    it('returns ghost-written text in physician voice', async () => {
      mockAiChat.mockResolvedValueOnce({ content: 'We will obtain MRI brain with DWI protocol to evaluate for acute ischemic stroke.' } as any);

      const res = await request(app)
        .post('/api/ai/scribe/ghost-write')
        .set('Cookie', authCookie)
        .send({
          chatAnswer: 'MRI brain with DWI is indicated for stroke workup',
          destinationSection: 'Plan',
          existingContent: 'Will obtain CBC and BMP.',
          noteType: 'progress_note',
          specialty: 'Neurology',
        });

      expect(res.status).toBe(200);
      expect(typeof res.body.ghostWritten).toBe('string');
      expect(res.body.ghostWritten.length).toBeGreaterThan(0);
    });
  });

  describe('POST /resolve-suggestion', () => {
    it('returns ready=true with noteText when AI has enough context', async () => {
      mockAiChat.mockResolvedValueOnce({
        content: JSON.stringify({ ready: true, noteText: 'Ischemic stroke, left MCA territory.' }),
      } as any);

      const res = await request(app)
        .post('/api/ai/scribe/resolve-suggestion')
        .set('Cookie', authCookie)
        .send({
          suggestion: 'Document stroke type (ischemic vs hemorrhagic) and vascular territory',
          sectionName: 'Assessment',
          existingContent: 'Patient with acute neurological deficits.',
          transcript: 'The patient suffered an ischemic stroke involving the left MCA territory.',
          noteType: 'progress_note',
          verbosity: 'standard',
        });

      expect(res.status).toBe(200);
      expect(res.body.ready).toBe(true);
      expect(typeof res.body.noteText).toBe('string');
      expect(res.body.noteText.length).toBeGreaterThan(0);
    });

    it('returns ready=false with question and options when AI needs clarification', async () => {
      mockAiChat.mockResolvedValueOnce({
        content: JSON.stringify({
          ready: false,
          question: 'What type of stroke?',
          options: ['Ischemic', 'Hemorrhagic', 'Embolic'],
        }),
      } as any);

      const res = await request(app)
        .post('/api/ai/scribe/resolve-suggestion')
        .set('Cookie', authCookie)
        .send({
          suggestion: 'Document stroke type (ischemic vs hemorrhagic) and vascular territory',
          sectionName: 'Assessment',
          existingContent: 'Patient with acute neurological deficits.',
          transcript: 'Patient has new neuro deficits.',
          noteType: 'progress_note',
          verbosity: 'standard',
        });

      expect(res.status).toBe(200);
      expect(res.body.ready).toBe(false);
      expect(typeof res.body.question).toBe('string');
      expect(Array.isArray(res.body.options)).toBe(true);
      expect(res.body.options.length).toBe(3);
    });

    it('returns 400 if suggestion is missing', async () => {
      const res = await request(app)
        .post('/api/ai/scribe/resolve-suggestion')
        .set('Cookie', authCookie)
        .send({ sectionName: 'Assessment' });
      expect(res.status).toBe(400);
    });

    it('returns 401 without auth', async () => {
      const res = await request(app)
        .post('/api/ai/scribe/resolve-suggestion')
        .send({ suggestion: 'x', sectionName: 'Assessment' });
      expect(res.status).toBe(401);
    });

    it('returns 400 if sectionName is missing', async () => {
      const res = await request(app)
        .post('/api/ai/scribe/resolve-suggestion')
        .set('Cookie', authCookie)
        .send({ suggestion: 'Document stroke type' });
      expect(res.status).toBe(400);
    });

    it('ready=false options do not include generic escape text', async () => {
      mockAiChat.mockResolvedValueOnce({
        content: JSON.stringify({
          ready: false,
          question: 'What artery was involved?',
          options: ['Left MCA', 'Right MCA', 'Basilar artery'],
        }),
      } as any);

      const res = await request(app)
        .post('/api/ai/scribe/resolve-suggestion')
        .set('Cookie', authCookie)
        .send({
          suggestion: 'Document vascular territory',
          sectionName: 'Assessment',
          transcript: 'Patient with acute stroke symptoms.',
          noteType: 'progress_note',
          verbosity: 'standard',
        });

      expect(res.status).toBe(200);
      expect(res.body.ready).toBe(false);
      expect(res.body.options.length).toBe(3);
      const escapeTerms = ['not yet', 'unknown', 'not determined', 'tbd'];
      res.body.options.forEach((opt: string) => {
        expect(escapeTerms.some(t => opt.toLowerCase().includes(t))).toBe(false);
      });
    });

    it('returns 500 when AI returns non-JSON', async () => {
      mockAiChat.mockResolvedValueOnce({ content: 'Sorry, I cannot help with that.' } as any);

      const res = await request(app)
        .post('/api/ai/scribe/resolve-suggestion')
        .set('Cookie', authCookie)
        .send({
          suggestion: 'Document stroke type',
          sectionName: 'Assessment',
          transcript: 'Patient has neuro deficits.',
        });

      expect(res.status).toBe(500);
    });

    it('passes through response when AI returns 2 options instead of 3', async () => {
      mockAiChat.mockResolvedValueOnce({
        content: JSON.stringify({
          ready: false,
          question: 'What type of stroke?',
          options: ['Ischemic', 'Hemorrhagic'],
        }),
      } as any);

      const res = await request(app)
        .post('/api/ai/scribe/resolve-suggestion')
        .set('Cookie', authCookie)
        .send({
          suggestion: 'Document stroke type',
          sectionName: 'Assessment',
          transcript: 'Patient with neuro deficits.',
          noteType: 'progress_note',
          verbosity: 'standard',
        });

      expect(res.status).toBe(200);
      expect(res.body.ready).toBe(false);
      expect(res.body.options).toEqual(['Ischemic', 'Hemorrhagic']);
    });

    it('passes through response when AI returns 4 options (old escape-option habit)', async () => {
      mockAiChat.mockResolvedValueOnce({
        content: JSON.stringify({
          ready: false,
          question: 'What type of stroke?',
          options: ['Ischemic', 'Hemorrhagic', 'Embolic', 'Not yet determined'],
        }),
      } as any);

      const res = await request(app)
        .post('/api/ai/scribe/resolve-suggestion')
        .set('Cookie', authCookie)
        .send({
          suggestion: 'Document stroke type',
          sectionName: 'Assessment',
          transcript: 'Patient with neuro deficits.',
          noteType: 'progress_note',
          verbosity: 'standard',
        });

      expect(res.status).toBe(200);
      expect(res.body.ready).toBe(false);
      expect(res.body.options.length).toBe(4);
    });

    it('system prompt explicitly forbids transcript artifact commentary in noteText', async () => {
      mockAiChat.mockResolvedValueOnce({
        content: JSON.stringify({ ready: true, noteText: 'Patient has hypertension, managed with lisinopril.' }),
      } as any);

      await request(app)
        .post('/api/ai/scribe/resolve-suggestion')
        .set('Cookie', authCookie)
        .send({
          suggestion: 'Document blood pressure management',
          sectionName: 'Assessment',
          transcript: 'Patient on lisinopril. Also mentioned visiting www.FEMA.gov for disaster prep.',
          noteType: 'progress_note',
          verbosity: 'standard',
        });

      expect(mockAiChat).toHaveBeenCalledTimes(1);
      const callArgs = mockAiChat.mock.calls[0][0] as any;
      const systemPrompt: string = callArgs.messages.find((m: any) => m.role === 'system')?.content ?? '';
      expect(systemPrompt).toMatch(/transcription.*artifact|source.*artifact|transcription quality/i);
    });

    it('returns 500 if AI returns empty options array', async () => {
      mockAiChat.mockResolvedValueOnce({
        content: JSON.stringify({
          ready: false,
          question: 'What type of stroke?',
          options: [],
        }),
      } as any);

      const res = await request(app)
        .post('/api/ai/scribe/resolve-suggestion')
        .set('Cookie', authCookie)
        .send({
          suggestion: 'Document stroke type',
          sectionName: 'Assessment',
          transcript: 'Patient with neuro deficits.',
          noteType: 'progress_note',
          verbosity: 'standard',
        });

      expect(res.status).toBe(500);
      expect(res.body.error).toMatch(/no options/i);
    });
  });
});
