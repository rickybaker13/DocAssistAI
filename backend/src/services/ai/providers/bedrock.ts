/**
 * AWS Bedrock Provider
 * Uses the Bedrock Converse API — works with all model families:
 * Amazon Nova, Meta Llama, DeepSeek, Mistral, Anthropic Claude, etc.
 */

import {
  BedrockRuntimeClient,
  ConverseCommand,
  type Message,
  type SystemContentBlock,
} from '@aws-sdk/client-bedrock-runtime';
import { BaseAIProvider } from './base.js';
import { AIMessage, AIResponse } from '../../../types/index.js';

export class BedrockProvider extends BaseAIProvider {
  private client: BedrockRuntimeClient;

  constructor(region: string, model: string) {
    super('bedrock', model);
    this.client = new BedrockRuntimeClient({ region });
  }

  async chat(
    messages: AIMessage[],
    options?: { temperature?: number; maxTokens?: number },
  ): Promise<AIResponse> {
    // Separate system messages — Converse API takes them separately
    const systemMessages = messages.filter((m) => m.role === 'system');
    const conversationMessages = messages.filter((m) => m.role !== 'system');

    const system: SystemContentBlock[] = systemMessages.length
      ? [{ text: systemMessages.map((m) => m.content).join('\n') }]
      : [];

    const converseMessages: Message[] = conversationMessages.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: [{ text: m.content }],
    }));

    const command = new ConverseCommand({
      modelId: this.model,
      messages: converseMessages,
      ...(system.length && { system }),
      inferenceConfig: {
        maxTokens: options?.maxTokens ?? 4096,
        temperature: options?.temperature ?? 0.7,
      },
    });

    const MAX_RETRIES = 2;
    let lastError: any;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const response = await this.client.send(command);

        const textBlock = response.output?.message?.content?.find(
          (b) => b.text !== undefined,
        );
        if (!textBlock?.text) {
          throw new Error('No text content in Bedrock Converse response');
        }

        return {
          content: textBlock.text,
          model: this.model,
          provider: 'bedrock',
          usage: {
            prompt_tokens: response.usage?.inputTokens,
            completion_tokens: response.usage?.outputTokens,
            total_tokens: response.usage?.totalTokens,
          },
        };
      } catch (error: any) {
        lastError = error;
        const code = error.name || error.__type || '';

        // ThrottlingException — retry for transient rate limits; give up
        // immediately for daily quota exhaustion (message contains "per day").
        const isThrottling = code === 'ThrottlingException';
        const isDailyQuota = isThrottling && /per day/i.test(error.message || '');

        if (isThrottling && !isDailyQuota && attempt < MAX_RETRIES) {
          const delay = Math.pow(2, attempt) * 1000; // 1s, 2s
          await new Promise((r) => setTimeout(r, delay));
          continue;
        }

        const message = error.message || String(error);
        const err = new Error(`AWS Bedrock API error [${code || 'UnknownError'}]: ${message}`);
        (err as any).isThrottling = isThrottling;
        throw err;
      }
    }

    // Unreachable — loop always returns or throws — but satisfies TS.
    throw lastError;
  }

  // Override to avoid making a live Bedrock call on every health check.
  // Cloud API providers don't have a cheap ping endpoint — config validity
  // is the best proxy, and real credential/access errors surface on the
  // first actual AI call.
  async isAvailable(): Promise<boolean> {
    return Boolean(this.model && this.client);
  }
}
