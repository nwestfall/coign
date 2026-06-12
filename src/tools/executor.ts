/**
 * Tool execution — timeout, serialization, error handling.
 */

import type { ToolDefinition } from '../types.js';
import { getConfig } from '../config.js';

export interface ToolResult {
  ok: boolean;
  result?: string;
  error?: string;
  message?: string;
}

export async function executeTool(def: ToolDefinition, args: Record<string, any>): Promise<ToolResult> {
  const timeoutMs = getConfig().toolTimeoutMs ?? 5000;

  let timer: ReturnType<typeof setTimeout>;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('TIMEOUT')), timeoutMs);
  });

  try {
    const raw = await Promise.race([def.execute(args), timeoutPromise]);
    clearTimeout(timer!);
    return { ok: true, result: serialize(raw) };
  } catch (err) {
    clearTimeout(timer!);
    const message = err instanceof Error ? err.message : String(err);
    if (message === 'TIMEOUT') {
      return { ok: false, error: 'TIMEOUT', message: `Tool "${def.name}" timed out after ${timeoutMs}ms.` };
    }
    return { ok: false, error: 'INTERNAL', message };
  }
}

function serialize(value: unknown): string {
  if (value === undefined || value === null) return 'null';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}
