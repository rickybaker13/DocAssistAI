/**
 * Discovery API Routes
 * Handles note discovery and analysis endpoints
 */

import { Router, Request, Response } from 'express';
import { noteAnalyzer } from '../services/discovery/noteAnalyzer.js';

const router = Router();

// Cache for discovery reports (in production, use Redis or database)
const discoveryCache = new Map<string, any>();

/**
 * POST /api/discovery/analyze-notes
 * Analyze notes and return discovery report
 */
router.post('/analyze-notes', async (req: Request, res: Response) => {
  try {
    const { notes } = req.body;

    if (!notes || !Array.isArray(notes) || notes.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Notes array is required',
      });
    }

    console.log(`[Discovery API] Analyzing ${notes.length} notes...`);

    // Analyze note structures
    const structureAnalyses = await Promise.all(
      notes.slice(0, 10).map(async (note: any) => {
        try {
          return await noteAnalyzer.analyzeNoteStructure(note.content || '', note.type || 'Unknown');
        } catch (error: any) {
          console.error(`[Discovery API] Error analyzing note ${note.id}:`, error);
          return null;
        }
      })
    );

    const validAnalyses = structureAnalyses.filter(a => a !== null);

    // Identify note type patterns
    const noteTypePatterns = await noteAnalyzer.identifyNoteTypePatterns(
      notes.map((n: any) => ({
        type: n.type || 'Unknown',
        content: n.content || '',
      }))
    );

    // Identify provider role patterns
    const providers = notes.reduce((acc: any[], note: any) => {
      const existing = acc.find(p => p.provider === note.author);
      if (existing) {
        if (!existing.noteTypes.includes(note.type)) {
          existing.noteTypes.push(note.type);
        }
      } else {
        acc.push({
          provider: note.author || 'Unknown',
          role: note.role,
          service: note.service,
          noteTypes: [note.type || 'Unknown'],
          sampleContent: note.content || '',
        });
      }
      return acc;
    }, []);

    const providerRolePatterns = await noteAnalyzer.identifyProviderRolePatterns(providers);

    // Suggest note type mappings
    const sandboxTypes = Array.from(new Set(notes.map((n: any) => n.type || 'Unknown')));
    const internalTypes = ['h_and_p', 'progress_note', 'procedure_note', 'accept_note', 'discharge_summary', 'consult_note'];
    const suggestedMappings = noteAnalyzer.suggestNoteTypeMappings(sandboxTypes, internalTypes);

    const report = {
      totalNotes: notes.length,
      structureAnalyses: validAnalyses,
      noteTypePatterns,
      providerRolePatterns,
      suggestedMappings: Object.fromEntries(suggestedMappings),
      generatedAt: new Date().toISOString(),
    };

    // Cache report (keyed by patient ID if available)
    const patientId = req.body.patientId;
    if (patientId) {
      discoveryCache.set(patientId, report);
    }

    res.json({
      success: true,
      data: report,
    });
  } catch (error: any) {
    console.error('[Discovery API] Error analyzing notes:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to analyze notes',
    });
  }
});

/**
 * GET /api/discovery/report/:patientId
 * Get cached discovery report
 */
router.get('/report/:patientId', async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const report = discoveryCache.get(patientId);

    if (!report) {
      return res.status(404).json({
        success: false,
        error: 'Discovery report not found for this patient',
      });
    }

    res.json({
      success: true,
      data: report,
    });
  } catch (error: any) {
    console.error('[Discovery API] Error getting report:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get discovery report',
    });
  }
});

/**
 * GET /api/discovery/note-types
 * List all discovered note types from cached reports
 */
router.get('/note-types', async (req: Request, res: Response) => {
  try {
    const noteTypes = new Set<string>();

    for (const report of discoveryCache.values()) {
      if (report.noteTypePatterns) {
        report.noteTypePatterns.forEach((pattern: any) => {
          noteTypes.add(pattern.type);
        });
      }
    }

    res.json({
      success: true,
      data: {
        noteTypes: Array.from(noteTypes),
        count: noteTypes.size,
      },
    });
  } catch (error: any) {
    console.error('[Discovery API] Error getting note types:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get note types',
    });
  }
});

/**
 * GET /api/discovery/provider-types
 * List all discovered provider types from cached reports
 */
router.get('/provider-types', async (req: Request, res: Response) => {
  try {
    const providers = new Map<string, any>();

    for (const report of discoveryCache.values()) {
      if (report.providerRolePatterns) {
        report.providerRolePatterns.forEach((pattern: any) => {
          if (!providers.has(pattern.provider)) {
            providers.set(pattern.provider, {
              provider: pattern.provider,
              role: pattern.role,
              service: pattern.service,
              noteTypes: pattern.typicalNoteTypes || [],
            });
          }
        });
      }
    }

    res.json({
      success: true,
      data: {
        providers: Array.from(providers.values()),
        count: providers.size,
      },
    });
  } catch (error: any) {
    console.error('[Discovery API] Error getting provider types:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get provider types',
    });
  }
});

export default router;

