/**
 * Manual XML function-calling loop.
 * Injects tool schemas into the system prompt as XML,
 * parses <function_calls> from model output,
 * executes tools, and feeds <function_results> back.
 *
 * This is the Phase 1 tool-calling path. All 3 smoke-test models
 * use this format.
 */

import type { ChatCompletionMessageParam } from '@mlc-ai/web-llm';
import type { ToolCall } from '../types.js';
import { chatCompletion } from '../core/engine.js';
import { listTools, lookupTool, isKnownTool } from '../tools/registry.js';
import { executeTool } from '../tools/executor.js';
import { isAutoApproved } from '../tools/risk-tiers.js';
import { showConfirmDialog } from '../ui/modal.js';
import { emit } from '../events.js';

export interface TurnResult {
  answer: string;
  toolCalls: ToolCall[];
}

export async function runManualToolLoop(
  messages: ChatCompletionMessageParam[],
  maxTurns = 5
): Promise<TurnResult> {
  const toolCalls: ToolCall[] = [];

  for (let turn = 0; turn < maxTurns; turn++) {
    const response = await chatCompletion(messages);
    const calls = parseFunctionCalls(response);

    if (calls.length === 0) {
      return { answer: response, toolCalls };
    }

    // Execute each tool call
    const results: string[] = [];
    for (const call of calls) {
      toolCalls.push(call);
      emit('toolCall', { name: call.name, args: call.args });

      if (!isKnownTool(call.name)) {
        results.push(formatResult(call.name, { ok: false, error: 'NO_SUCH_TOOL', name: call.name }));
        emit('toolResult', { name: call.name, result: { ok: false, error: 'NO_SUCH_TOOL' }, durationMs: 0 });
        continue;
      }

      const def = lookupTool(call.name)!;
      if (!isAutoApproved(def.risk)) {
        const confirmText = def.confirmMessage
          ? def.confirmMessage(call.args)
          : `Tool "${call.name}" (${def.description}) wants to execute.`;
        const confirmed = await showConfirmDialog(confirmText, def.risk ?? 'write', call.name);
        if (!confirmed) {
          results.push(formatResult(call.name, { ok: false, error: 'USER_DENIED', name: call.name }));
          emit('toolResult', { name: call.name, result: { ok: false, error: 'USER_DENIED' }, durationMs: 0 });
          continue;
        }
      }

      const start = performance.now();
      const result = await executeTool(def, call.args);
      const durationMs = Math.round(performance.now() - start);
      emit('toolResult', { name: call.name, result, durationMs });

      results.push(formatResult(call.name, result));
    }

    // Append assistant message + function results to history
    messages.push({ role: 'assistant', content: response });
    messages.push({ role: 'user', content: results.join('\n') });
  }

  // Max turns exceeded — return last assistant content
  const lastAssistant = messages
    .slice()
    .reverse()
    .find((m) => m.role === 'assistant');
  return { answer: (lastAssistant?.content as string) ?? '', toolCalls };
}

export function buildSystemPrompt(basePrompt: string): string {
  const toolList = listTools();
  if (toolList.length === 0) {
    return basePrompt;
  }

  let xml = `${basePrompt}\n\nYou have access to the following tools. When you need to use a tool, output exactly one or more <function_calls> blocks. After you receive <function_results>, continue the conversation.\n\n<tools>\n`;
  for (const { fullName, def } of toolList) {
    xml += `  <tool name="${fullName}">\n`;
    xml += `    <description>${escapeXml(def.description)}</description>\n`;
    xml += `    <parameters>${escapeXml(JSON.stringify(def.parameters, null, 2))}</parameters>\n`;
    xml += `  </tool>\n`;
  }
  xml += `</tools>\n\n`;
  xml += `To call a tool, use this exact XML format:\n`;
  xml += `<function_calls>\n`;
  xml += `  <invoke name="agent.searchPage">\n`;
  xml += `    <parameter name="query">...</parameter>\n`;
  xml += `  </invoke>\n`;
  xml += `</function_calls>\n`;
  return xml;
}

function parseFunctionCalls(text: string): ToolCall[] {
  const calls: ToolCall[] = [];
  const callRegex = /<invoke\s+name="([^"]+)"\s*>(.*?)<\/invoke>/gs;
  let match;
  while ((match = callRegex.exec(text)) !== null) {
    const name = match[1];
    const body = match[2];
    const args: Record<string, any> = {};
    const paramRegex = /<parameter\s+name="([^"]+)"\s*>(.*?)<\/parameter>/gs;
    let paramMatch;
    while ((paramMatch = paramRegex.exec(body)) !== null) {
      const key = paramMatch[1];
      const val = paramMatch[2].trim();
      // Try JSON parse, fall back to string
      try {
        args[key] = JSON.parse(val);
      } catch {
        args[key] = val;
      }
    }
    calls.push({ name, args });
  }
  return calls;
}

function formatResult(name: string, result: Record<string, any>): string {
  return `<function_results>\n  <result name="${name}">\n${escapeXml(JSON.stringify(result, null, 2))}\n  </result>\n</function_results>`;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
