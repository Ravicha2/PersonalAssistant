import type { ServerMessage } from '../types.js';

export type LLMProvider = 'claude' | 'openai' | 'groq';

export interface LLMOptions {
  provider: LLMProvider;
  api_key: string;
  model: string;
}

export interface UnifiedTool {
  name: string;
  description: string;
  input_schema: { type: 'object'; properties: Record<string, unknown>; required?: string[] };
}

export interface StreamTurnResult {
  toolUses: Array<{ id: string; name: string; input: Record<string, unknown> }>;
  assistantMessage: unknown;
  usage?: { input_tokens: number; output_tokens: number };
}

export interface StreamTurnOptions {
  systemPrompt: string;
  messages: unknown;
  tools: UnifiedTool[];
  apiKey: string;
  model: string;
}

export interface LLMAdapter {
  streamTurn(
    opts: StreamTurnOptions,
    send: (m: ServerMessage) => void
  ): Promise<StreamTurnResult>;
}
