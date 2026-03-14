import Anthropic from '@anthropic-ai/sdk';
import type { LLMAdapter } from './types.js';
import type { StreamTurnOptions, StreamTurnResult, UnifiedTool } from './types.js';
import type { ServerMessage } from '../types.js';

export function createAnthropicAdapter(): LLMAdapter {
  return {
    async streamTurn(
      opts: StreamTurnOptions,
      send: (m: ServerMessage) => void
    ): Promise<StreamTurnResult> {
      const client = new Anthropic({ apiKey: opts.apiKey });
      const messages = opts.messages as Anthropic.MessageParam[];
      const toolUses: StreamTurnResult['toolUses'] = [];
      let currentToolUseId: string | null = null;
      let currentToolName: string | null = null;
      let currentToolInputJson = '';

      const streamOptions: Record<string, unknown> = {
        model: opts.model,
        max_tokens: 4096,
        system: opts.systemPrompt,
        messages,
      };
      if (opts.tools.length > 0) {
        streamOptions.tools = opts.tools;
        streamOptions.tool_choice = { type: 'auto' };
      }

      const stream = client.messages.stream(streamOptions as unknown as Parameters<Anthropic['messages']['stream']>[0]);

      for await (const event of stream) {
        if (event.type === 'content_block_delta') {
          const delta = event.delta as { type?: string; text?: string; id?: string; name?: string; partial_json?: string };
          if (delta.type === 'text_delta' && delta.text) {
            send({ type: 'text_delta', delta: delta.text });
          }
          if (delta.type === 'tool_use') {
            currentToolUseId = delta.id ?? null;
            currentToolName = delta.name ?? null;
            currentToolInputJson = '';
            toolUses.push({ id: delta.id!, name: delta.name!, input: {} });
            send({ type: 'tool_use', id: delta.id!, name: delta.name!, input: {} });
          }
          if (delta.type === 'input_json_delta' && delta.partial_json !== undefined) {
            currentToolInputJson += delta.partial_json;
          }
        }
        if (event.type === 'content_block_stop' && currentToolUseId && currentToolName) {
          try {
            const input = currentToolInputJson ? (JSON.parse(currentToolInputJson) as Record<string, unknown>) : {};
            const idx = toolUses.findIndex((t) => t.id === currentToolUseId);
            if (idx >= 0) toolUses[idx].input = input;
            send({ type: 'tool_use', id: currentToolUseId, name: currentToolName, input });
          } catch {
            // ignore partial json
          }
          currentToolUseId = null;
          currentToolName = null;
        }
      }

      const finalMessage = await stream.finalMessage();
      const usage = finalMessage.usage
        ? { input_tokens: finalMessage.usage.input_tokens ?? 0, output_tokens: finalMessage.usage.output_tokens ?? 0 }
        : undefined;

      return {
        toolUses,
        assistantMessage: { role: 'assistant' as const, content: finalMessage.content },
        usage,
      };
    },
  };
}
