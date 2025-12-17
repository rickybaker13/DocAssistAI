/**
 * AI Service
 * Main service for AI operations with HIPAA compliance
 */

import { getAIProvider } from './providerFactory.js';
import { AIMessage, AIResponse, ChatRequest, DocumentRequest } from '../../types/index.js';
import { redactPHI } from '../../middleware/phiProtection.js';
import { logAIServiceUsage } from '../audit/auditLogger.js';

export class AIService {
  /**
   * Process chat request with patient context
   */
  async chat(request: ChatRequest, context: {
    userId?: string;
    patientId?: string;
    ipAddress?: string;
  }): Promise<AIResponse> {
    const provider = getAIProvider();
    const providerName = provider.getName();

    try {
      // Prepare messages
      let messages: AIMessage[] = request.messages;

      // Add patient context if provided
      if (request.patientContext) {
        // Optionally redact PHI before sending to AI
        const patientContext = process.env.ENABLE_PHI_REDACTION === 'true'
          ? redactPHI(request.patientContext)
          : request.patientContext;

        // Add system prompt with patient context
        const systemPrompt: AIMessage = {
          role: 'system',
          content: `You are a clinical assistant helping healthcare providers understand patient data.
Use the following patient information to answer questions accurately and concisely.
Always cite specific data points when possible.

Patient Context:
${patientContext}`,
        };

        messages = [systemPrompt, ...messages];
      }

      // Call AI provider
      const response = await provider.chat(messages, request.options);

      // Log successful usage
      logAIServiceUsage(
        context.userId,
        context.patientId,
        providerName,
        '/api/ai/chat',
        context.ipAddress,
        true,
        undefined,
        {
          model: response.model,
          usage: response.usage,
        }
      );

      return response;
    } catch (error: any) {
      // Log error
      logAIServiceUsage(
        context.userId,
        context.patientId,
        providerName,
        '/api/ai/chat',
        context.ipAddress,
        false,
        error.message
      );

      throw error;
    }
  }

  /**
   * Generate clinical document
   */
  async generateDocument(
    request: DocumentRequest,
    context: {
      userId?: string;
      patientId?: string;
      ipAddress?: string;
    }
  ): Promise<string> {
    const provider = getAIProvider();
    const providerName = provider.getName();

    try {
      // Optionally redact PHI
      const patientData = process.env.ENABLE_PHI_REDACTION === 'true'
        ? redactPHI(request.patientData)
        : request.patientData;

      const contextText = request.additionalContext
        ? `Additional Context: ${request.additionalContext}\n\n`
        : '';

      const messages: AIMessage[] = [
        {
          role: 'system',
          content: `You are a clinical documentation assistant. Generate professional, accurate clinical notes based on the provided patient data and template structure.`,
        },
        {
          role: 'user',
          content: `${contextText}Template Structure:\n${request.template}\n\nPatient Data:\n${patientData}\n\nGenerate the clinical note following the template structure.`,
        },
      ];

      const response = await provider.chat(messages, {
        temperature: 0.5,
      });

      // Log successful usage
      logAIServiceUsage(
        context.userId,
        context.patientId,
        providerName,
        '/api/ai/generate-document',
        context.ipAddress,
        true,
        undefined,
        {
          model: response.model,
          template: request.template,
        }
      );

      return response.content;
    } catch (error: any) {
      // Log error
      logAIServiceUsage(
        context.userId,
        context.patientId,
        providerName,
        '/api/ai/generate-document',
        context.ipAddress,
        false,
        error.message
      );

      throw error;
    }
  }
}

export const aiService = new AIService();

