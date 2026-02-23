import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import scribeAiRouter from './scribeAi';
import { ScribeUserModel } from '../models/scribeUser';
import { closeDb } from '../database/db';

// Mock the AI service so tests don't call real OpenAI
jest.mock('../services/ai/aiService', () => ({
  aiService: {
    chat: jest.fn(),
  },
}));

import { aiService } from '../services/ai/aiService';
const mockAiChat = aiService.chat as jest.Mock;

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use('/api/ai/scribe', scribeAiRouter);

const SECRET = 'test-secret';
let authCookie: string;

describe('Scribe AI Routes', () => {
  beforeAll(() => {
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = SECRET;
    const user = new ScribeUserModel().create({ email: 'ai-test@test.com', passwordHash: 'hash' });
    const token = jwt.sign({ userId: user.id }, SECRET, { expiresIn: '1h' });
    authCookie = `scribe_token=${token}`;
  });
  afterAll(() => closeDb());

  describe('POST /generate', () => {
    it('generates sections from transcript', async () => {
      mockAiChat.mockResolvedValueOnce({ content: JSON.stringify({
        sections: [
          { name: 'HPI', content: 'Patient presents with chest pain.', confidence: 0.9 },
          { name: 'Assessment', content: 'Likely ACS.', confidence: 0.85 },
        ],
      }) });

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
  });

  describe('POST /focused', () => {
    it('returns focused analysis for a section', async () => {
      mockAiChat.mockResolvedValueOnce({ content: JSON.stringify({
        analysis: 'Deep analysis of the section.',
        citations: [{ guideline: 'Surviving Sepsis Campaign', recommendation: 'Use norepinephrine first-line' }],
        suggestions: ['Consider adding MAP targets'],
        confidence_breakdown: 'Content well-supported',
      }) });

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
      mockAiChat.mockResolvedValueOnce({ content: 'We will obtain MRI brain with DWI protocol to evaluate for acute ischemic stroke.' });

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
});
