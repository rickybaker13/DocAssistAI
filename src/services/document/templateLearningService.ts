/**
 * Template Learning Service (Frontend)
 * Service for triggering template learning and viewing learned templates
 */

export interface LearnedTemplate {
  id: string;
  name: string;
  noteType: string;
  role: string[];
  service?: string;
  provider?: string;
  sections: string[];
  confidence: number;
  sourceNotes: number;
}

export interface TemplateLearningResult {
  success: boolean;
  data?: {
    templatesDiscovered: number;
    templates: LearnedTemplate[];
  };
  error?: string;
}

export interface AllTemplatesResult {
  success: boolean;
  data?: {
    templates: Array<{
      id: string;
      name: string;
      noteType: string;
      role: string[];
      service?: string;
      provider?: string;
      sections: string[];
      isLearned: boolean;
      confidence?: number;
      discoveredAt?: string;
    }>;
    learnedCount: number;
    hardcodedCount: number;
  };
  error?: string;
}

import { getBackendUrl } from '../../config/appConfig';

class TemplateLearningService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = getBackendUrl();
  }

  /**
   * Learn templates from clinical notes
   */
  async learnFromNotes(clinicalNotes: any[]): Promise<TemplateLearningResult> {
    try {
      const response = await fetch(`${this.baseUrl}/api/ai/learn-templates`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clinicalNotes,
        }),
      });

      const result = await response.json();
      return result;
    } catch (error: any) {
      console.error('[Template Learning Service] Error learning templates:', error);
      return {
        success: false,
        error: error.message || 'Failed to learn templates',
      };
    }
  }

  /**
   * Get all templates (hardcoded + learned)
   */
  async getAllTemplates(noteType?: string, role?: string): Promise<AllTemplatesResult> {
    try {
      const params = new URLSearchParams();
      if (noteType) params.append('noteType', noteType);
      if (role) params.append('role', role);

      const url = `${this.baseUrl}/api/ai/templates${params.toString() ? `?${params.toString()}` : ''}`;
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();
      return result;
    } catch (error: any) {
      console.error('[Template Learning Service] Error getting templates:', error);
      return {
        success: false,
        error: error.message || 'Failed to get templates',
      };
    }
  }

  /**
   * Clear learned templates
   */
  async clearLearnedTemplates(): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/api/ai/templates/learned`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();
      return result;
    } catch (error: any) {
      console.error('[Template Learning Service] Error clearing templates:', error);
      return {
        success: false,
        error: error.message || 'Failed to clear learned templates',
      };
    }
  }
}

export const templateLearningService = new TemplateLearningService();

