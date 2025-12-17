/**
 * AI Service
 * Handles interactions with AI providers (OpenAI or OpenRouter)
 */

import axios from 'axios';
import { AIMessage, AIResponse } from '../../types';
import { getAIEndpoint, getAIApiKey, getAIModel, appConfig } from '../../config/appConfig';

class AIService {
  private apiKey: string;
  private endpoint: string;
  private model: string;
  private provider: 'openai' | 'openrouter';

  constructor() {
    this.apiKey = getAIApiKey();
    this.endpoint = getAIEndpoint();
    this.model = getAIModel();
    this.provider = appConfig.aiProvider;

    if (!this.apiKey) {
      console.warn('AI API key not configured');
    }
  }

  /**
   * Send a chat completion request
   */
  async chat(messages: AIMessage[], options?: {
    temperature?: number;
    maxTokens?: number;
    systemPrompt?: string;
  }): Promise<AIResponse> {
    if (!this.apiKey) {
      throw new Error('AI API key not configured. Please set VITE_OPENAI_API_KEY or VITE_OPENROUTER_API_KEY in .env.local');
    }

    // Add system prompt if provided
    const messageList: AIMessage[] = options?.systemPrompt
      ? [{ role: 'system', content: options.systemPrompt }, ...messages]
      : messages;

    const requestBody: any = {
      model: this.model,
      messages: messageList.map(msg => ({
        role: msg.role,
        content: msg.content,
      })),
      temperature: options?.temperature ?? 0.7,
    };

    if (options?.maxTokens) {
      requestBody.max_tokens = options.maxTokens;
    }

    // Add provider-specific headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.provider === 'openrouter') {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
      headers['HTTP-Referer'] = window.location.origin;
      headers['X-Title'] = 'DocAssistAI';
    } else {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    try {
      const response = await axios.post(this.endpoint, requestBody, { headers });
      
      const choice = response.data.choices?.[0];
      if (!choice) {
        throw new Error('No response from AI service');
      }

      return {
        content: choice.message?.content || '',
        model: response.data.model,
        usage: response.data.usage,
      };
    } catch (error: any) {
      console.error('AI service error:', error);
      throw new Error(
        error.response?.data?.error?.message || 
        'Failed to get response from AI service'
      );
    }
  }

  /**
   * Query patient data with AI
   */
  async queryPatientData(question: string, patientContext: string): Promise<string> {
    const systemPrompt = `You are a clinical assistant helping healthcare providers understand patient data. 
Use the following patient information to answer questions accurately and concisely.
Always cite specific data points when possible.`;

    const messages: AIMessage[] = [
      {
        role: 'user',
        content: `Patient Context:\n${patientContext}\n\nQuestion: ${question}`,
      },
    ];

    const response = await this.chat(messages, {
      systemPrompt,
      temperature: 0.3, // Lower temperature for more factual responses
    });

    return response.content;
  }

  /**
   * Generate clinical document
   */
  async generateDocument(
    template: string,
    patientData: string,
    additionalContext?: string
  ): Promise<string> {
    const systemPrompt = `You are a clinical documentation assistant. Generate professional, accurate clinical notes based on the provided patient data and template structure.`;

    const context = additionalContext
      ? `Additional Context: ${additionalContext}\n\n`
      : '';

    const messages: AIMessage[] = [
      {
        role: 'user',
        content: `${context}Template Structure:\n${template}\n\nPatient Data:\n${patientData}\n\nGenerate the clinical note following the template structure.`,
      },
    ];

    const response = await this.chat(messages, {
      systemPrompt,
      temperature: 0.5,
    });

    return response.content;
  }
}

export const aiService = new AIService();

