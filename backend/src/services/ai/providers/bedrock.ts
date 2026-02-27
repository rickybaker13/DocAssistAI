/**
 * AWS Bedrock Provider
 * Handles communication with Claude via AWS Bedrock Runtime
 */

import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from '@aws-sdk/client-bedrock-runtime';
import { BaseAIProvider } from './base.js';
import { AIMessage, AIResponse } from '../../../types/index.js';

export class BedrockProvider extends BaseAIProvider {
  private client: BedrockRuntimeClient;

  constructor(region: string, model: string) {
    super('bedrock', model);
    // Credentials are resolved automatically by the AWS SDK credential chain:
    // env vars (AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY), shared credentials
    // file, ECS task role, EC2 instance profile, etc.
    this.client = new BedrockRuntimeClient({ region });
  }

  async chat(
    messages: AIMessage[],
    options?: { temperature?: number; maxTokens?: number },
  ): Promise<AIResponse> {
    try {
      // Separate system messages (Bedrock Claude uses the same Messages API shape)
      const systemMessages = messages.filter((m) => m.role === 'system');
      const userMessages = messages.filter((m) => m.role !== 'system');

      const system =
        systemMessages.map((m) => m.content).join('\n') || undefined;

      const body: Record<string, unknown> = {
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: options?.maxTokens ?? 4096,
        temperature: options?.temperature ?? 0.7,
        messages: userMessages.map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })),
      };
      if (system) {
        body.system = system;
      }

      const command = new InvokeModelCommand({
        modelId: this.model,
        contentType: 'application/json',
        accept: 'application/json',
        body: new TextEncoder().encode(JSON.stringify(body)),
      });

      const response = await this.client.send(command);
      const result = JSON.parse(new TextDecoder().decode(response.body));

      const textBlock = (result.content as Array<{ type: string; text?: string }>)?.find(
        (b) => b.type === 'text',
      );
      if (!textBlock?.text) {
        throw new Error('No text content in Bedrock response');
      }

      return {
        content: textBlock.text,
        model: result.model ?? this.model,
        provider: 'bedrock',
        usage: {
          prompt_tokens: result.usage?.input_tokens,
          completion_tokens: result.usage?.output_tokens,
          total_tokens:
            (result.usage?.input_tokens ?? 0) +
            (result.usage?.output_tokens ?? 0),
        },
      };
    } catch (error: any) {
      throw new Error(
        `AWS Bedrock API error: ${error.message || String(error)}`,
      );
    }
  }
}
