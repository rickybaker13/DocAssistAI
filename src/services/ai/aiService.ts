/**
 * AI Service
 * Handles interactions with backend AI API
 * Backend manages AI providers (external or self-hosted) for HIPAA compliance
 */

import axios from 'axios';
import { AIMessage, AIResponse } from '../../types';
import { smartAuthService } from '../auth/smartAuthService';

class AIService {
  private backendUrl: string;

  constructor() {
    // Backend API URL - defaults to localhost in dev, can be configured via env
    this.backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';
  }

  /**
   * Send a chat completion request via backend API
   */
  async chat(messages: AIMessage[], options?: {
    temperature?: number;
    maxTokens?: number;
    systemPrompt?: string;
    patientContext?: string;
  }): Promise<AIResponse> {
    // Add system prompt if provided
    const messageList: AIMessage[] = options?.systemPrompt
      ? [{ role: 'system', content: options.systemPrompt }, ...messages]
      : messages;

    // Get SMART context for audit logging
    let userId: string | undefined;
    let patientId: string | undefined;
    try {
      const context = smartAuthService.getLaunchContext();
      patientId = context.patientId;
      userId = context.userId;
    } catch {
      // Not launched from EHR - that's okay for development
    }

    const requestBody = {
      messages: messageList,
      patientContext: options?.patientContext,
      options: {
        temperature: options?.temperature ?? 0.7,
        maxTokens: options?.maxTokens,
      },
    };

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Add context headers for HIPAA audit logging
    if (userId) headers['X-User-Id'] = userId;
    if (patientId) headers['X-Patient-Id'] = patientId;

    try {
      const response = await axios.post(
        `${this.backendUrl}/api/ai/chat`,
        requestBody,
        { headers }
      );

      if (!response.data.success) {
        throw new Error(response.data.error || 'AI service error');
      }

      return response.data.data;
    } catch (error: any) {
      console.error('AI service error:', error);
      throw new Error(
        error.response?.data?.error || 
        error.message ||
        'Failed to get response from AI service'
      );
    }
  }

  /**
   * Query patient data with AI
   */
  async queryPatientData(question: string, patientContext: string): Promise<string> {
    const messages: AIMessage[] = [
      {
        role: 'user',
        content: question,
      },
    ];

    const response = await this.chat(messages, {
      patientContext, // Backend handles system prompt with patient context
      temperature: 0.3, // Lower temperature for more factual responses
    });

    return response.content;
  }

  /**
   * Generate clinical document via backend API
   */
  async generateDocument(
    template: string,
    patientData: string,
    additionalContext?: string
  ): Promise<string> {
    // Get SMART context for audit logging
    let userId: string | undefined;
    let patientId: string | undefined;
    try {
      const context = smartAuthService.getLaunchContext();
      patientId = context.patientId;
      userId = context.userId;
    } catch {
      // Not launched from EHR - that's okay for development
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (userId) headers['X-User-Id'] = userId;
    if (patientId) headers['X-Patient-Id'] = patientId;

    try {
      const response = await axios.post(
        `${this.backendUrl}/api/ai/generate-document`,
        {
          template,
          patientData,
          additionalContext,
        },
        { headers }
      );

      if (!response.data.success) {
        throw new Error(response.data.error || 'Document generation failed');
      }

      return response.data.data.content;
    } catch (error: any) {
      console.error('Document generation error:', error);
      throw new Error(
        error.response?.data?.error ||
        error.message ||
        'Failed to generate document'
      );
    }
  }
}

export const aiService = new AIService();

