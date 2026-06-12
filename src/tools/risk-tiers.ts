/**
 * Risk tier enforcement.
 */

import type { ToolDefinition } from '../types.js';
import { getConfig } from '../config.js';

export function isAutoApproved(risk: ToolDefinition['risk']): boolean {
  const autoApprove = getConfig().autoApprove ?? ['read'];
  if (!risk) return autoApprove.includes('read');
  return autoApprove.includes(risk);
}

export function tierLabel(risk: ToolDefinition['risk']): string {
  return risk ?? 'read';
}
