/**
 * Document Service
 * Frontend service for document generation
 */

import axios from 'axios';
import { GeneratedDocument, QualityCheck } from '../stores/documentStore';
import { PatientSummary } from '../types';
import { getBackendUrl } from '../../config/appConfig';

class DocumentService {
  private backendUrl: string;

  constructor() {
    this.backendUrl = getBackendUrl();
  }

  /**
   * Generate document
   */
  async generateDocument(
    noteType: 'h_and_p' | 'progress_note' | 'procedure_note' | 'accept_note' | 'discharge_summary' | 'consult_note',
    userContext: {
      role: 'MD' | 'NP' | 'PA' | 'RN' | 'PT' | 'ST' | 'RT' | 'WC' | 'PC' | 'CH' | 'OTHER';
      service?: string;
      name?: string;
    },
    patientSummary: PatientSummary,
    patientId: string,
    date?: string
  ): Promise<{ document: GeneratedDocument; qualityCheck: QualityCheck; template: { id: string; name: string } }> {
    try {
      const response = await axios.post(
        `${this.backendUrl}/api/ai/generate-document`,
        {
          noteType,
          userContext,
          patientSummary,
          patientId,
          date: date || new Date().toISOString(),
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.data.success) {
        throw new Error(response.data.error || 'Failed to generate document');
      }

      console.log('[Document Service] Document generated:', response.data.data);
      return response.data.data;
    } catch (error: any) {
      console.error('Document generation error:', error);
      throw new Error(
        error.response?.data?.error ||
        error.message ||
        'Failed to generate document'
      );
    }
  }

  /**
   * Edit document with natural language command
   */
  async editDocument(
    command: string,
    document: GeneratedDocument,
    patientSummary: PatientSummary
  ): Promise<{ success: boolean; updatedDocument: GeneratedDocument; changes: string[]; error?: string }> {
    try {
      const response = await axios.post(
        `${this.backendUrl}/api/ai/edit-document`,
        {
          command,
          document,
          patientSummary,
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.data.success) {
        throw new Error(response.data.error || 'Failed to edit document');
      }

      return response.data.data;
    } catch (error: any) {
      console.error('Document editing error:', error);
      throw new Error(
        error.response?.data?.error ||
        error.message ||
        'Failed to edit document'
      );
    }
  }
}

export const documentService = new DocumentService();

