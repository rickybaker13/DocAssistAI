/**
 * AI API Routes
 * Handles AI-related API endpoints
 */

import { Router, Request, Response } from 'express';
import { aiService } from '../services/ai/aiService.js';
import { ChatRequest, DocumentRequest } from '../types/index.js';
import { patientDataIndexer } from '../services/rag/patientDataIndexer.js';
import { ragService } from '../services/rag/ragService.js';
import { estimateTokens, countMessageTokens, formatTokenCount, analyzeMessages } from '../utils/tokenCounter.js';
import { contextStore } from '../services/signal/contextStore.js';
import type { ClinicalEvent } from '../services/signal/fhirNormalizer.js';
import { buildCoWriterPrompt } from '../services/cowriter/noteBuilder.js';
import { logAIServiceUsage } from '../services/audit/auditLogger.js';

const router = Router();

/**
 * POST /api/ai/chat
 * Chat completion endpoint with Signal Engine chart-grounded context and citation support
 */
router.post('/chat', async (req: Request, res: Response) => {
  try {
    const request: ChatRequest = {
      messages: req.body.messages || [],
      patientContext: req.body.patientContext,
      options: req.body.options,
    };

    // Validate request
    if (!request.messages || request.messages.length === 0) {
      return res.status(400).json({
        error: 'Messages are required',
      });
    }

    // Get context from middleware
    const context = (req as any).phiContext || {};
    const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';

    // ── Signal Engine: inject chart-grounded context ──────────────────────────
    const sessionId = (req.headers['x-session-id'] || req.headers['x-patient-id'] || '') as string;
    const cached = sessionId ? contextStore.get(sessionId) : null;

    let chartContext = '';
    if (cached?.timeline?.events?.length) {
      const events = cached.timeline.events.slice(0, 200);
      chartContext = events
        .map((e: ClinicalEvent) =>
          `[${e.timestamp}] ${e.type.toUpperCase()} | ${e.label}: ${e.value ?? ''} ${e.unit ?? ''}${e.isAbnormal ? ' ABNORMAL' : ''}`
        )
        .join('\n');
    }

    if (chartContext) {
      // Override patientContext with the structured chart timeline for citation-grounded answers
      request.patientContext = `You are a critical care physician AI assistant. Answer questions about this specific patient using ONLY the chart data provided below.
For every fact you state, cite the source with format [Source: <label>, <timestamp>].
If the data does not contain the answer, say "This information is not in the available chart data."
Be concise and clinically precise. Do not speculate or add information not present in the data.

PATIENT CHART DATA:
${chartContext}`;
    } else {
      // No verified chart data — instruct AI not to make patient-specific claims
      request.patientContext = `You are a critical care physician AI assistant. No verified patient chart data is currently loaded for this session. Answer general medical questions only. Do NOT make patient-specific claims or reference specific lab values, vital signs, or clinical findings for any individual patient.`;
    }

    const cited = !!chartContext;

    // ── RAG fallback (when no Signal Engine cache) ────────────────────────────
    const useRAG = req.body.useRAG !== false; // Default to true if not specified

    // Log initial context size
    const initialContextSize = estimateTokens(req.body.patientContext || '');
    console.log(`\n[Chat Request] Initial patient context: ${formatTokenCount(initialContextSize)}`);

    if (!cited && useRAG && ragService.isAvailable()) {
      try {
        // Extract query from last user message
        const lastMessage = request.messages[request.messages.length - 1];
        const query = lastMessage.role === 'user' ? lastMessage.content : '';

        if (query) {
          console.log(`[RAG] Query: "${query.substring(0, 100)}${query.length > 100 ? '...' : ''}"`);

          // Retrieve relevant context using RAG
          const ragResult = await ragService.retrieve(query, 5, 0.5);

          // Log RAG results
          const ragContextSize = estimateTokens(ragResult.retrievedContext);
          const reduction = initialContextSize > 0
            ? ((1 - ragContextSize / initialContextSize) * 100).toFixed(1)
            : '0';

          console.log(`\n[RAG] Context Size Comparison:`);
          console.log(`  Full context: ${formatTokenCount(initialContextSize)}`);
          console.log(`  RAG context: ${formatTokenCount(ragContextSize)}`);
          console.log(`  Reduction: ${reduction}%`);
          console.log(`  Retrieved ${ragResult.documents.length} documents`);

          // Log what documents were retrieved
          console.log(`\n[RAG] Retrieved Documents:`);
          ragResult.documents.forEach((doc, idx) => {
            const docTokens = estimateTokens(doc.content);
            const preview = doc.content.substring(0, 80).replace(/\n/g, ' ');
            console.log(`  [${idx + 1}] ${doc.metadata.type || 'unknown'}: ${formatTokenCount(docTokens)}`);
            console.log(`      Preview: "${preview}${doc.content.length > 80 ? '...' : ''}"`);
          });

          // Use RAG-retrieved context instead of full patient context
          request.patientContext = ragResult.retrievedContext;
        } else {
          console.warn('[RAG] No user query found, using full context');
        }
      } catch (ragError: any) {
        console.warn('[RAG] RAG retrieval failed, falling back to full context:', ragError.message);
        console.warn(`[RAG] Error details:`, ragError);
        // Fall back to using full patient context
      }
    } else if (!cited) {
      if (!useRAG) {
        console.log('[RAG] RAG disabled, using full patient context');
      } else if (!ragService.isAvailable()) {
        console.warn('[RAG] RAG service not available, using full patient context');
        const stats = ragService.getIndexStats();
        console.warn(`[RAG] Index stats:`, stats);
      }
    }

    // Log what will be sent to LLM
    const finalContextSize = estimateTokens(request.patientContext || '');
    const userMessageTokens = estimateTokens(request.messages[request.messages.length - 1]?.content || '');

    console.log(`\n[AI Request] Preparing to send to LLM:`);
    console.log(`  Patient context: ${formatTokenCount(finalContextSize)}`);
    console.log(`  User message: ${formatTokenCount(userMessageTokens)}`);
    console.log(`  Total messages: ${request.messages.length}`);
    console.log(`  Chart-grounded (cited): ${cited}`);

    // Process chat request
    const response = await aiService.chat(request, {
      ...context,
      ipAddress,
    });

    // Log response usage if available
    if (response.usage) {
      console.log(`\n[AI Response] Token Usage:`);
      console.log(`  Prompt tokens: ${response.usage.prompt_tokens ?? 'N/A'}`);
      console.log(`  Completion tokens: ${response.usage.completion_tokens ?? 'N/A'}`);
      console.log(`  Total tokens: ${response.usage.total_tokens ?? 'N/A'}`);
    }

    res.json({
      success: true,
      cited,
      data: response,
    });
  } catch (error: any) {
    console.error('Chat error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to process chat request',
    });
  }
});

/**
 * POST /api/ai/generate-document
 * Co-Writer: Chart-grounded clinical note generation using Signal Engine context
 */
router.post('/generate-document', async (req: Request, res: Response) => {
  try {
    const { template = 'Progress Note', context: additionalContext, patientData } = req.body;
    const sessionId = (req.headers['x-session-id'] || req.headers['x-patient-id'] || '') as string;

    // Get cached timeline if available
    const cached = sessionId ? contextStore.get(sessionId) : null;

    let timelineData = '';
    if (cached?.timeline?.events?.length) {
      timelineData = cached.timeline.events
        .slice(0, 300)
        .map((e: ClinicalEvent) =>
          `[${e.timestamp}] ${e.type.toUpperCase()} | ${e.label}: ${e.value ?? ''} ${e.unit ?? ''}${e.isAbnormal ? ' ABNORMAL' : ''}`
        )
        .join('\n');
    } else if (patientData && typeof patientData === 'object' && patientData.patient?.id) {
      // Only accept structured patient data — reject arbitrary payloads
      const safeFields = ['labs', 'vitals', 'medications', 'medicationAdmins', 'conditions', 'encounters', 'diagnosticReports', 'procedures', 'notes', 'deviceMetrics', 'fetchedAt'];
      const safeData: Record<string, unknown> = { patient: { id: patientData.patient.id } };
      for (const field of safeFields) {
        if (Array.isArray(patientData[field])) {
          safeData[field] = patientData[field];
        }
      }
      timelineData = JSON.stringify(safeData).slice(0, 10000);
    }

    const prompt = buildCoWriterPrompt(template, timelineData, additionalContext);

    // Build a ChatRequest with the co-writer prompt as the user message
    const chatRequest: ChatRequest = {
      messages: [{ role: 'user', content: prompt }],
    };

    // Get context from middleware
    const phiContext = (req as any).phiContext || {};
    const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';

    const aiResponse = await aiService.chat(chatRequest, {
      userId: phiContext.userId,
      patientId: phiContext.patientId || sessionId,
      ipAddress,
    });

    const rawResponse = aiResponse.content;

    let parsed: unknown;
    try {
      // Strip markdown code fences if present
      const cleaned = rawResponse.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '');
      parsed = JSON.parse(cleaned);
    } catch {
      parsed = {
        noteType: template,
        sections: [{ name: 'Note', content: rawResponse, sources: [] }],
        generatedAt: new Date().toISOString(),
      };
    }

    logAIServiceUsage(
      phiContext.userId,
      phiContext.patientId || sessionId,
      'co-writer',
      '/api/ai/generate-document',
      ipAddress,
      true,
      undefined,
      {
        noteType: template,
        hasCachedTimeline: !!cached,
      }
    );

    res.json({ document: parsed, noteType: template });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Document generation failed';
    console.error('Co-Writer document generation error:', err);
    res.status(500).json({ error: message });
  }
});

/**
 * POST /api/ai/edit-document
 * Smart document editing endpoint (Pattern 12: Human-in-the-Loop)
 */
router.post('/edit-document', async (req: Request, res: Response) => {
  try {
    const { smartEditor } = await import('../services/document/smartEditor.js');

    const editCommand = {
      command: req.body.command,
      document: req.body.document,
      patientSummary: req.body.patientSummary,
    };

    if (!editCommand.command || !editCommand.document) {
      return res.status(400).json({
        error: 'Command and document are required',
      });
    }

    // Process edit command
    const editResult = await smartEditor.processEditCommand(editCommand);

    // Get context from middleware
    const context = (req as any).phiContext || {};
    const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';

    // Log usage
    const { logAIServiceUsage } = await import('../services/audit/auditLogger.js');
    logAIServiceUsage(
      context.userId,
      context.patientId,
      'smart-editor',
      '/api/ai/edit-document',
      ipAddress,
      editResult.success,
      editResult.error,
      {
        command: editCommand.command,
        changes: editResult.changes,
      }
    );

    res.json({
      success: editResult.success,
      data: editResult,
    });
  } catch (error: any) {
    console.error('Document editing error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to edit document',
    });
  }
});

/**
 * POST /api/ai/index-patient-data
 * Index patient data for RAG
 */
router.post('/index-patient-data', async (req: Request, res: Response) => {
  try {
    const patientSummary = req.body.patientSummary;

    if (!patientSummary) {
      return res.status(400).json({
        success: false,
        error: 'Patient summary is required',
      });
    }

    console.log('[RAG Index] Starting patient data indexing...');
    
    // Index patient data
    await patientDataIndexer.indexPatientData(patientSummary);

    const stats = ragService.getIndexStats();

    console.log('[RAG Index] Successfully indexed patient data:', stats);

    res.json({
      success: true,
      data: {
        message: 'Patient data indexed successfully',
        documentCount: stats.documentCount,
      },
    });
  } catch (error: any) {
    console.error('[RAG Index] Indexing error:', error);
    console.error('[RAG Index] Error stack:', error.stack);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to index patient data',
    });
  }
});

/**
 * GET /api/ai/rag/stats
 * Get RAG index statistics
 */
router.get('/rag/stats', async (req: Request, res: Response) => {
  try {
    const stats = ragService.getIndexStats();
    res.json({
      success: true,
      data: stats,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get RAG stats',
    });
  }
});

/**
 * POST /api/ai/learn-templates
 * Learn templates from existing clinical notes (Pattern 9: Learning & Adaptation)
 */
router.post('/learn-templates', async (req: Request, res: Response) => {
  try {
    const { templateLearner } = await import('../services/document/templateLearner.js');
    const { templateRouter } = await import('../services/document/templateRouter.js');

    const clinicalNotes = req.body.clinicalNotes || [];

    if (!clinicalNotes || clinicalNotes.length === 0) {
      return res.status(400).json({
        error: 'Clinical notes are required',
      });
    }

    console.log(`[Template Learning] Learning from ${clinicalNotes.length} notes...`);

    // Learn templates from notes
    const discoveredTemplates = await templateLearner.learnFromNotes(clinicalNotes);

    // Convert to router templates and add to router
    const routerTemplates = discoveredTemplates.map(dt => templateLearner.toRouterTemplate(dt));
    templateRouter.addLearnedTemplates(routerTemplates);

    // Get context from middleware
    const context = (req as any).phiContext || {};
    const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';

    // Log usage
    const { logAIServiceUsage } = await import('../services/audit/auditLogger.js');
    logAIServiceUsage(
      context.userId,
      context.patientId,
      'template-learner',
      '/api/ai/learn-templates',
      ipAddress,
      true,
      undefined,
      {
        notesAnalyzed: clinicalNotes.length,
        templatesDiscovered: discoveredTemplates.length,
      }
    );

    res.json({
      success: true,
      data: {
        templatesDiscovered: discoveredTemplates.length,
        templates: discoveredTemplates.map(t => ({
          id: t.id,
          name: t.name,
          noteType: t.noteType,
          role: t.role,
          service: t.service,
          provider: t.provider,
          sections: t.sections,
          confidence: t.confidence,
          sourceNotes: t.sourceNotes.length,
        })),
      },
    });
  } catch (error: any) {
    console.error('Template learning error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to learn templates',
    });
  }
});

/**
 * GET /api/ai/templates
 * Get all available templates (hardcoded + learned)
 */
router.get('/templates', async (req: Request, res: Response) => {
  try {
    const { templateRouter } = await import('../services/document/templateRouter.js');
    const { templateLearner } = await import('../services/document/templateLearner.js');

    const noteType = req.query.noteType as string | undefined;
    const role = req.query.role as string | undefined;

    let allTemplates = templateRouter.getAllTemplates();

    // Filter by note type if provided
    if (noteType) {
      allTemplates = allTemplates.filter(t => t.noteType === noteType);
    }

    // Filter by role if provided
    if (role) {
      allTemplates = allTemplates.filter(t => t.role.includes(role as any) || t.role.length === 0);
    }

    // Get learned templates metadata
    const learnedTemplates = templateLearner.getLearnedTemplates();
    const learnedMap = new Map(learnedTemplates.map(t => [t.id, t]));

    res.json({
      success: true,
      data: {
        templates: allTemplates.map(t => {
          const learned = learnedMap.get(t.id);
          return {
            id: t.id,
            name: t.name,
            noteType: t.noteType,
            role: t.role,
            service: t.service,
            provider: t.provider,
            sections: t.sections,
            isLearned: !!learned,
            confidence: learned?.confidence,
            discoveredAt: learned?.discoveredAt,
          };
        }),
        learnedCount: learnedTemplates.length,
        hardcodedCount: allTemplates.length - learnedTemplates.length,
      },
    });
  } catch (error: any) {
    console.error('Get templates error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get templates',
    });
  }
});

/**
 * DELETE /api/ai/templates/learned
 * Clear learned templates
 */
router.delete('/templates/learned', async (req: Request, res: Response) => {
  try {
    const { templateRouter } = await import('../services/document/templateRouter.js');
    const { templateLearner } = await import('../services/document/templateLearner.js');

    templateLearner.clearLearnedTemplates();
    templateRouter.clearLearnedTemplates();

    res.json({
      success: true,
      data: {
        message: 'Learned templates cleared',
      },
    });
  } catch (error: any) {
    console.error('Clear templates error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to clear learned templates',
    });
  }
});

/**
 * GET /api/ai/health
 * Health check endpoint
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    const { getAIProvider } = await import('../services/ai/providerFactory.js');
    const provider = getAIProvider();
    const isAvailable = await provider.isAvailable();

    res.json({
      success: true,
      data: {
        provider: provider.getName(),
        available: isAvailable,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Health check failed',
    });
  }
});

export default router;

