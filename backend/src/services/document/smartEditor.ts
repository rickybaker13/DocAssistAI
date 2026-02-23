/**
 * Smart Editor (Pattern 12: Human-in-the-Loop)
 * Handles natural language editing commands for documents
 */

import { getAIProvider } from '../ai/providerFactory.js';
import { AIMessage } from '../../types/index.js';
import { GeneratedDocument } from './documentGenerator.js';
import { documentTools } from './documentTools.js';

export interface EditCommand {
  command: string; // Natural language command
  document: GeneratedDocument;
  patientSummary: any;
}

export interface EditResult {
  success: boolean;
  updatedDocument: GeneratedDocument;
  changes: string[];
  error?: string;
}

export class SmartEditor {
  /**
   * Process editing command and update document
   */
  async processEditCommand(command: EditCommand): Promise<EditResult> {
    const provider = getAIProvider();

    // Parse command intent
    const intent = await this.parseCommandIntent(command.command);

    // Execute command based on intent
    switch (intent.type) {
      case 'add_trend':
        return await this.addTrend(command, intent.params);
      case 'add_graph':
        return await this.addGraph(command, intent.params);
      case 'expand_section':
        return await this.expandSection(command, intent.params);
      case 'add_data':
        return await this.addData(command, intent.params);
      case 'remove_section':
        return await this.removeSection(command, intent.params);
      case 'modify_text':
        return await this.modifyText(command, intent.params);
      default:
        return await this.generalEdit(command);
    }
  }

  /**
   * Parse command intent
   */
  private async parseCommandIntent(command: string): Promise<{
    type: string;
    params: Record<string, any>;
  }> {
    const provider = getAIProvider();
    const messages: AIMessage[] = [
      {
        role: 'system',
        content: 'You are a command parser for document editing. Parse the user command and identify the intent.',
      },
      {
        role: 'user',
        content: `Parse this editing command: "${command}"

Identify the intent type and parameters. Types include:
- add_trend: Add trend data for a lab/vital
- add_graph: Add a graph/chart
- expand_section: Expand a section with more detail
- add_data: Add specific data point
- remove_section: Remove a section
- modify_text: General text modification

Return JSON:
{
  "type": "add_trend",
  "params": {
    "labName": "lactate",
    "days": 3
  }
}`,
      },
    ];

    try {
      const response = await provider.chat(messages, { temperature: 0.3 });
      const parsed = JSON.parse(response.content);
      return parsed;
    } catch {
      // Fallback: simple keyword matching
      const cmdLower = command.toLowerCase();
      if (cmdLower.includes('trend')) {
        const labMatch = command.match(/(\w+)\s+trend/i);
        return {
          type: 'add_trend',
          params: { labName: labMatch ? labMatch[1] : 'lactate', days: 3 },
        };
      }
      if (cmdLower.includes('graph') || cmdLower.includes('chart')) {
        return { type: 'add_graph', params: {} };
      }
      if (cmdLower.includes('expand')) {
        return { type: 'expand_section', params: {} };
      }
      return { type: 'modify_text', params: {} };
    }
  }

  /**
   * Add trend data
   */
  private async addTrend(
    command: EditCommand,
    params: Record<string, any>
  ): Promise<EditResult> {
    const labName = params.labName || 'lactate';
    const days = params.days || 3;

    // Fetch trend data
    const trendResult = await documentTools.fetchTrendData(labName, days);
    if (!trendResult.success || !trendResult.data) {
      return {
        success: false,
        updatedDocument: command.document,
        changes: [],
        error: `Failed to fetch trend data for ${labName}`,
      };
    }

    // Generate trend text
    const provider = getAIProvider();
    const trendText = trendResult.data.values
      .map((v: any) => `${new Date(v.date).toLocaleDateString()}: ${v.value} ${v.unit}`)
      .join('\n');

    const messages: AIMessage[] = [
      {
        role: 'system',
        content: 'You are a clinical documentation assistant. Add trend data to the document appropriately.',
      },
      {
        role: 'user',
        content: `Add this ${labName} trend data to the document:\n\n${trendText}\n\nCurrent document:\n${command.document.content}\n\nIntegrate the trend into the appropriate section (usually Objective or Assessment).`,
      },
    ];

    try {
      const response = await provider.chat(messages, { temperature: 0.4 });
      return {
        success: true,
        updatedDocument: {
          ...command.document,
          content: response.content,
        },
        changes: [`Added ${labName} trend for last ${days} days`],
      };
    } catch (error: any) {
      return {
        success: false,
        updatedDocument: command.document,
        changes: [],
        error: error.message,
      };
    }
  }

  /**
   * Add graph (placeholder for future implementation)
   */
  private async addGraph(
    command: EditCommand,
    params: Record<string, any>
  ): Promise<EditResult> {
    return {
      success: true,
      updatedDocument: {
        ...command.document,
        content: command.document.content + '\n\n[Graph placeholder - will be implemented]',
      },
      changes: ['Added graph placeholder'],
    };
  }

  /**
   * Expand section
   */
  private async expandSection(
    command: EditCommand,
    params: Record<string, any>
  ): Promise<EditResult> {
    const provider = getAIProvider();
    const sectionName = params.section || 'Assessment';

    const messages: AIMessage[] = [
      {
        role: 'system',
        content: 'You are a clinical documentation assistant. Expand a section with more detail.',
      },
      {
        role: 'user',
        content: `Expand the "${sectionName}" section in this document with more clinical detail:\n\n${command.document.content}`,
      },
    ];

    try {
      const response = await provider.chat(messages, { temperature: 0.5 });
      return {
        success: true,
        updatedDocument: {
          ...command.document,
          content: response.content,
        },
        changes: [`Expanded ${sectionName} section`],
      };
    } catch (error: any) {
      return {
        success: false,
        updatedDocument: command.document,
        changes: [],
        error: error.message,
      };
    }
  }

  /**
   * Add specific data
   */
  private async addData(
    command: EditCommand,
    params: Record<string, any>
  ): Promise<EditResult> {
    return await this.generalEdit(command);
  }

  /**
   * Remove section
   */
  private async removeSection(
    command: EditCommand,
    params: Record<string, any>
  ): Promise<EditResult> {
    const sectionName = params.section || '';
    const provider = getAIProvider();

    const messages: AIMessage[] = [
      {
        role: 'system',
        content: 'You are a clinical documentation assistant. Remove a section from the document.',
      },
      {
        role: 'user',
        content: `Remove the "${sectionName}" section from this document:\n\n${command.document.content}`,
      },
    ];

    try {
      const response = await provider.chat(messages, { temperature: 0.3 });
      return {
        success: true,
        updatedDocument: {
          ...command.document,
          content: response.content,
        },
        changes: [`Removed ${sectionName} section`],
      };
    } catch (error: any) {
      return {
        success: false,
        updatedDocument: command.document,
        changes: [],
        error: error.message,
      };
    }
  }

  /**
   * Modify text (general editing)
   */
  private async modifyText(
    command: EditCommand,
    params: Record<string, any>
  ): Promise<EditResult> {
    return await this.generalEdit(command);
  }

  /**
   * General edit handler
   */
  private async generalEdit(command: EditCommand): Promise<EditResult> {
    const provider = getAIProvider();

    const messages: AIMessage[] = [
      {
        role: 'system',
        content: 'You are a clinical documentation assistant. Modify the document according to the user\'s request.',
      },
      {
        role: 'user',
        content: `User request: "${command.command}"\n\nCurrent document:\n${command.document.content}\n\nModify the document according to the request.`,
      },
    ];

    try {
      const response = await provider.chat(messages, { temperature: 0.4 });
      return {
        success: true,
        updatedDocument: {
          ...command.document,
          content: response.content,
        },
        changes: [`Applied: ${command.command}`],
      };
    } catch (error: any) {
      return {
        success: false,
        updatedDocument: command.document,
        changes: [],
        error: error.message,
      };
    }
  }
}

export const smartEditor = new SmartEditor();

