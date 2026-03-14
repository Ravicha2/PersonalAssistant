import type { LLMAdapter, LLMProvider } from './types.js';
import { createAnthropicAdapter } from './anthropic.js';
import { createOpenAICompatAdapter } from './openai-compat.js';

const OPENAI_BASE = 'https://api.openai.com/v1';
const GROQ_BASE = 'https://api.groq.com/openai/v1';

export type { LLMAdapter, LLMOptions, LLMProvider, StreamTurnResult, UnifiedTool } from './types.js';

export function getAdapter(provider: LLMProvider): LLMAdapter {
  switch (provider) {
    case 'claude':
      return createAnthropicAdapter();
    case 'openai':
      return createOpenAICompatAdapter(OPENAI_BASE);
    case 'groq':
      return createOpenAICompatAdapter(GROQ_BASE);
    default:
      throw new Error(`Unknown LLM provider: ${provider}`);
  }
}

export const DEFAULT_MODELS: Record<LLMProvider, string> = {
  claude: 'claude-sonnet-4-20250514',
  openai: 'gpt-4o-mini',
  groq: 'llama-3.3-70b-versatile',
};
