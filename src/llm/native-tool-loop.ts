/**
 * Native OpenAI-style tool-calling loop (Phase 2).
 * Used by Hermes-2-Pro-Llama-3-8B and any model that supports
 * the standard `tools` field in chat.completions.create.
 *
 * Deferred to Phase 2 per decision log.
 */

import type { ChatCompletionMessageParam } from '@mlc-ai/web-llm';
import type { ToolCall } from '../types.js';
// import { chatCompletion } from '../core/engine.js';

export async function runNativeToolLoop(
  _messages: ChatCompletionMessageParam[],
  _tools: any[],
  _maxTurns = 5
): Promise<{ answer: string; toolCalls: ToolCall[] }> {
  throw new Error('Native tool loop not yet implemented — target Phase 2');
}
