// @ts-nocheck
/**
 * Document Tools (Pattern 5: Tool Use)
 * Tools for fetching data needed for document generation
 */

import { PatientSummary } from '../../types/index.js';
import { ragService } from '../rag/ragService.js';

export interface ToolResult {
  success: boolean;
  data?: any;
  error?: string;
}

export interface PreviousNote {
  id: string;
  type: string;
  date: string;
  content: string;
  author: string;
}

export class DocumentTools {
  private patientSummary: PatientSummary | null = null;

  /**
   * Set patient summary for tool operations
   */
  setPatientSummary(summary: PatientSummary): void {
    this.patientSummary = summary;
  }

  /**
   * Tool: Fetch previous note
   */
  async fetchPreviousNote(noteType: string, date: string): Promise<ToolResult> {
    try {
      if (!this.patientSummary) {
        return { success: false, error: 'Patient summary not set' };
      }

      // Search clinical notes for previous note of same type
      if (this.patientSummary.clinicalNotes) {
        const previousNotes = this.patientSummary.clinicalNotes
          .filter(note => note.type === noteType)
          .filter(note => {
            const noteDate = new Date(note.date || '');
            const targetDate = new Date(date);
            return noteDate < targetDate;
          })
          .sort((a, b) => {
            const dateA = new Date(a.date || '').getTime();
            const dateB = new Date(b.date || '').getTime();
            return dateB - dateA; // Most recent first
          });

        if (previousNotes.length > 0) {
          const previousNote = previousNotes[0];
          return {
            success: true,
            data: {
              id: previousNote.id,
              type: previousNote.type,
              date: previousNote.date,
              content: previousNote.content,
              author: previousNote.author,
            } as PreviousNote,
          };
        }
      }

      return { success: true, data: null }; // No previous note found
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Tool: Fetch labs for date range
   */
  async fetchLabs(startDate: string, endDate: string): Promise<ToolResult> {
    try {
      if (!this.patientSummary) {
        return { success: false, error: 'Patient summary not set' };
      }

      const start = new Date(startDate);
      const end = new Date(endDate);

      const labs = (this.patientSummary.recentLabs || [])
        .filter(lab => {
          if (!lab.effectiveDateTime) return false;
          const labDate = new Date(lab.effectiveDateTime);
          return labDate >= start && labDate <= end;
        })
        .sort((a, b) => {
          const dateA = new Date(a.effectiveDateTime || '').getTime();
          const dateB = new Date(b.effectiveDateTime || '').getTime();
          return dateB - dateA; // Most recent first
        });

      return {
        success: true,
        data: labs.map(lab => ({
          name: lab.code?.text || 'Unknown',
          value: lab.valueQuantity ? `${lab.valueQuantity.value} ${lab.valueQuantity.unit}` : lab.valueString || 'N/A',
          date: lab.effectiveDateTime,
        })),
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Tool: Fetch vitals for date range
   */
  async fetchVitals(startDate: string, endDate: string): Promise<ToolResult> {
    try {
      if (!this.patientSummary) {
        return { success: false, error: 'Patient summary not set' };
      }

      const start = new Date(startDate);
      const end = new Date(endDate);

      const vitals = (this.patientSummary.recentVitals || [])
        .filter(vital => {
          if (!vital.effectiveDateTime) return false;
          const vitalDate = new Date(vital.effectiveDateTime);
          return vitalDate >= start && vitalDate <= end;
        })
        .sort((a, b) => {
          const dateA = new Date(a.effectiveDateTime || '').getTime();
          const dateB = new Date(b.effectiveDateTime || '').getTime();
          return dateB - dateA; // Most recent first
        });

      return {
        success: true,
        data: vitals.map(vital => ({
          name: vital.code?.text || 'Unknown',
          value: vital.valueQuantity
            ? `${vital.valueQuantity.value} ${vital.valueQuantity.unit}`
            : vital.component
            ? `${vital.component[0]?.valueQuantity?.value}/${vital.component[1]?.valueQuantity?.value} ${vital.component[0]?.valueQuantity?.unit}`
            : 'N/A',
          date: vital.effectiveDateTime,
        })),
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Tool: Fetch imaging reports for date range
   */
  async fetchImaging(startDate: string, endDate: string): Promise<ToolResult> {
    try {
      if (!this.patientSummary) {
        return { success: false, error: 'Patient summary not set' };
      }

      const start = new Date(startDate);
      const end = new Date(endDate);

      const imaging = (this.patientSummary.imagingReports || [])
        .filter(report => {
          if (!report.effectiveDateTime) return false;
          const reportDate = new Date(report.effectiveDateTime);
          return reportDate >= start && reportDate <= end;
        })
        .sort((a, b) => {
          const dateA = new Date(a.effectiveDateTime || '').getTime();
          const dateB = new Date(b.effectiveDateTime || '').getTime();
          return dateB - dateA;
        });

      return {
        success: true,
        data: imaging.map(report => ({
          type: report.code?.text || 'Unknown',
          date: report.effectiveDateTime,
          conclusion: report.conclusion || 'No conclusion',
        })),
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Tool: Fetch microbiology results for date range
   */
  async fetchMicrobiology(startDate: string, endDate: string): Promise<ToolResult> {
    try {
      if (!this.patientSummary) {
        return { success: false, error: 'Patient summary not set' };
      }

      const start = new Date(startDate);
      const end = new Date(endDate);

      // Filter labs for microbiology (cultures)
      const microLabs = (this.patientSummary.recentLabs || [])
        .filter(lab => {
          if (!lab.effectiveDateTime) return false;
          const labDate = new Date(lab.effectiveDateTime);
          if (labDate < start || labDate > end) return false;

          // Check if it's a culture
          const labName = (lab.code?.text || '').toLowerCase();
          return labName.includes('culture') || labName.includes('microbiology') || lab.valueString;
        })
        .sort((a, b) => {
          const dateA = new Date(a.effectiveDateTime || '').getTime();
          const dateB = new Date(b.effectiveDateTime || '').getTime();
          return dateB - dateA;
        });

      return {
        success: true,
        data: microLabs.map(lab => ({
          name: lab.code?.text || 'Unknown',
          result: lab.valueString || (lab.valueQuantity ? `${lab.valueQuantity.value} ${lab.valueQuantity.unit}` : 'N/A'),
          date: lab.effectiveDateTime,
        })),
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Tool: Fetch ancillary service notes
   */
  async fetchAncillaryNotes(service: string, startDate: string, endDate: string): Promise<ToolResult> {
    try {
      if (!this.patientSummary) {
        return { success: false, error: 'Patient summary not set' };
      }

      const start = new Date(startDate);
      const end = new Date(endDate);

      const notes = (this.patientSummary.clinicalNotes || [])
        .filter(note => {
          if (!note.date) return false;
          const noteDate = new Date(note.date);
          if (noteDate < start || noteDate > end) return false;

          // Match service by author or note type
          const author = (note.author || '').toLowerCase();
          const noteType = (note.type || '').toLowerCase();
          const serviceLower = service.toLowerCase();

          return author.includes(serviceLower) || noteType.includes(serviceLower);
        })
        .sort((a, b) => {
          const dateA = new Date(a.date || '').getTime();
          const dateB = new Date(b.date || '').getTime();
          return dateB - dateA;
        });

      return {
        success: true,
        data: notes.map(note => ({
          id: note.id,
          type: note.type,
          author: note.author,
          date: note.date,
          content: note.content?.substring(0, 500) || '', // Truncate for context
        })),
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Tool: Fetch trend data for a specific lab
   */
  async fetchTrendData(labName: string, days: number): Promise<ToolResult> {
    try {
      if (!this.patientSummary) {
        return { success: false, error: 'Patient summary not set' };
      }

      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const labs = (this.patientSummary.recentLabs || [])
        .filter(lab => {
          if (!lab.effectiveDateTime) return false;
          const labDate = new Date(lab.effectiveDateTime);
          if (labDate < startDate || labDate > endDate) return false;

          const name = (lab.code?.text || '').toLowerCase();
          return name.includes(labName.toLowerCase());
        })
        .sort((a, b) => {
          const dateA = new Date(a.effectiveDateTime || '').getTime();
          const dateB = new Date(b.effectiveDateTime || '').getTime();
          return dateA - dateB; // Chronological order for trends
        });

      return {
        success: true,
        data: {
          labName,
          days,
          values: labs.map(lab => ({
            date: lab.effectiveDateTime,
            value: lab.valueQuantity ? lab.valueQuantity.value : null,
            unit: lab.valueQuantity?.unit || '',
          })),
        },
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Tool: Fetch all new data since last note
   */
  async fetchNewDataSinceLastNote(noteType: string, currentDate: string): Promise<ToolResult> {
    try {
      // Find last note date
      const previousNoteResult = await this.fetchPreviousNote(noteType, currentDate);
      const lastNoteDate = previousNoteResult.success && previousNoteResult.data
        ? previousNoteResult.data.date
        : null;

      const startDate = lastNoteDate || new Date(currentDate).toISOString();
      const endDate = currentDate;

      // Fetch all new data
      const [labs, vitals, imaging, micro] = await Promise.all([
        this.fetchLabs(startDate, endDate),
        this.fetchVitals(startDate, endDate),
        this.fetchImaging(startDate, endDate),
        this.fetchMicrobiology(startDate, endDate),
      ]);

      return {
        success: true,
        data: {
          labs: labs.success ? labs.data : [],
          vitals: vitals.success ? vitals.data : [],
          imaging: imaging.success ? imaging.data : [],
          microbiology: micro.success ? micro.data : [],
          sinceDate: startDate,
        },
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }
}

export const documentTools = new DocumentTools();

