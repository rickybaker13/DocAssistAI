/**
 * OpenAI Provider
 * Handles communication with OpenAI API
 */

import axios from 'axios';
import { BaseAIProvider } from './base.js';
import { AIMessage, AIResponse } from '../../../types';

export class OpenAIProvider extends BaseAIProvider {
  private apiKey: string;
  private endpoint: string;

  constructor(apiKey: string, model: string) {
    super('openai', model);
    this.apiKey = apiKey;
    this.endpoint = 'https://api.openai.com/v1/chat/completions';
  }

  async chat(messages: AIMessage[], options?: {
    temperature?: number;
    maxTokens?: number;
  }): Promise<AIResponse> {
    try {
      const response = await axios.post(
        this.endpoint,
        {
          model: this.model,
          messages: messages.map(msg => ({
            role: msg.role,
            content: msg.content,
          })),
          temperature: options?.temperature ?? 0.7,
          max_tokens: options?.maxTokens,
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const choice = response.data.choices?.[0];
      if (!choice) {
        throw new Error('No response from OpenAI');
      }

      return {
        content: choice.message?.content || '',
        model: response.data.model,
        provider: 'openai',
        usage: response.data.usage,
      };
    } catch (error: any) {
      throw new Error(
        `OpenAI API error: ${error.response?.data?.error?.message || error.message}`
      );
    }
  }
}

