/**
 * OpenAI-compatible API adapter (OpenAI + Groq).
 * Base URL: OpenAI = https://api.openai.com/v1, Groq = https://api.groq.com/openai/v1
 */
import type { LLMAdapter } from './types.js';
import type { StreamTurnOptions, StreamTurnResult, UnifiedTool } from './types.js';
import type { ServerMessage } from '../types.js';

interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant';
  content?: string | null;
  tool_calls?: Array<{ id: string; type: 'function'; function: { name: string; arguments: string } }>;
}
interface OpenAIChunk {
  choices?: Array<{
    delta?: {
      content?: string | null;
      tool_calls?: Array<{ index?: number; id?: string; function?: { name?: string; arguments?: string } }>;
    };
    finish_reason?: string | null;
  }>;
}

function openAITool(unified: UnifiedTool): { type: 'function'; function: { name: string; description: string; parameters: Record<string, unknown> } } {
  return {
    type: 'function',
    function: {
      name: unified.name,
      description: unified.description,
      parameters: unified.input_schema,
    },
  };
}

export function createOpenAICompatAdapter(baseURL: string): LLMAdapter {
  return {
    async streamTurn(
      opts: StreamTurnOptions,
      send: (m: ServerMessage) => void
    ): Promise<StreamTurnResult> {
      const messages = opts.messages as OpenAIMessage[];
      const body = {
        model: opts.model,
        stream: true,
        max_tokens: 4096,
        messages: [
          ...(opts.systemPrompt ? [{ role: 'system' as const, content: opts.systemPrompt }] : []),
          ...messages,
        ],
        ...(opts.tools.length > 0
          ? { tools: opts.tools.map(openAITool), tool_choice: 'auto' as const }
          : {}),
      };

      const res = await fetch(`${baseURL.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${opts.apiKey}`,
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(`LLM API error ${res.status}: ${err}`);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No response body');
      const decoder = new TextDecoder();
      let buffer = '';
      const toolCallsAccum: Array<{ id: string; name: string; arguments: string }> = [];
      const byIndex: Map<number, { id: string; name: string; args: string }> = new Map();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            if (data === '[DONE]') continue;
            try {
              const chunk = JSON.parse(data) as OpenAIChunk;
              const choice = chunk.choices?.[0];
              if (!choice) continue;
              const delta = choice.delta;
              if (delta?.content) send({ type: 'text_delta', delta: delta.content });
              if (delta?.tool_calls) {
                for (const tc of delta.tool_calls) {
                  const idx = tc.index ?? 0;
                  const cur = byIndex.get(idx) ?? { id: tc.id ?? '', name: tc.function?.name ?? '', args: '' };
                  if (tc.id) cur.id = tc.id;
                  if (tc.function?.name) cur.name = tc.function.name;
                  if (tc.function?.arguments) cur.args += tc.function.arguments;
                  byIndex.set(idx, cur);
                }
              }
            } catch {
              // skip invalid JSON
            }
          }
        }
      }

      for (const [, tc] of byIndex) {
        if (tc.id && tc.name) {
          try {
            const input = JSON.parse(tc.args || '{}') as Record<string, unknown>;
            toolCallsAccum.push({ id: tc.id, name: tc.name, arguments: tc.args });
            send({ type: 'tool_use', id: tc.id, name: tc.name, input });
          } catch {
            toolCallsAccum.push({ id: tc.id, name: tc.name, arguments: tc.args || '{}' });
          }
        }
      }

      const toolUses: StreamTurnResult['toolUses'] = [];
      for (const tc of toolCallsAccum) {
        try {
          const input = JSON.parse(tc.arguments || '{}') as Record<string, unknown>;
          toolUses.push({ id: tc.id, name: tc.name, input });
        } catch {
          toolUses.push({ id: tc.id, name: tc.name, input: {} });
        }
      }

      const assistantContent: OpenAIMessage['content'] = '';
      const assistantMessage: OpenAIMessage = {
        role: 'assistant',
        content: assistantContent || undefined,
        ...(toolUses.length > 0
          ? {
              tool_calls: toolUses.map((t) => ({
                id: t.id,
                type: 'function' as const,
                function: { name: t.name, arguments: JSON.stringify(t.input) },
              })),
            }
          : {}),
      };

      return {
        toolUses,
        assistantMessage,
      };
    },
  };
}
