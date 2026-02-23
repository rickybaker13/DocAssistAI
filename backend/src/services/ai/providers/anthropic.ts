/**
 * Anthropic Provider
 * Handles communication with Anthropic Claude API
 */

import Anthropic from '@anthropic-ai/sdk';
import { BaseAIProvider } from './base.js';
import { AIMessage, AIResponse } from '../../../types/index.js';

export class AnthropicProvider extends BaseAIProvider {
  private client: Anthropic;

  constructor(apiKey: string, model: string) {
    super('anthropic', model);
    this.client = new Anthropic({ apiKey });
  }

  async chat(messages: AIMessage[], options?: {
    temperature?: number;
    maxTokens?: number;
  }): Promise<AIResponse> {
    try {
      // Anthropic separates system messages from the messages array
      const systemMessages = messages.filter(m => m.role === 'system');
      const userMessages = messages.filter(m => m.role !== 'system');

      const system = systemMessages.map(m => m.content).join('\n') || undefined;

      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: options?.maxTokens ?? 4096,
        temperature: options?.temperature ?? 0.7,
        ...(system ? { system } : {}),
        messages: userMessages.map(m => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })),
      });

      const textBlock = response.content.find(b => b.type === 'text');
      if (!textBlock || textBlock.type !== 'text') {
        throw new Error('No text content in Anthropic response');
      }

      return {
        content: textBlock.text,
        model: response.model,
        provider: 'anthropic',
        usage: {
          prompt_tokens: response.usage.input_tokens,
          completion_tokens: response.usage.output_tokens,
          total_tokens: response.usage.input_tokens + response.usage.output_tokens,
        },
      };
    } catch (error: any) {
      throw new Error(
        `Anthropic API error: ${error.message || String(error)}`
      );
    }
  }
}
