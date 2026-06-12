/**
 * Conversation history persistence in localStorage.
 */

import type { ConversationEntry } from '../types.js';

const STORAGE_KEY = (origin: string) => `coign:conv:v1:${origin}`;
const MAX_MESSAGES = 50;
const MAX_BYTES = 100_000;

export function loadHistory(origin = location.origin): ConversationEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY(origin));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ConversationEntry[];
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

export function saveHistory(entries: ConversationEntry[], origin = location.origin): void {
  let trimmed = entries.slice(-MAX_MESSAGES);
  let json = JSON.stringify(trimmed);
  while (json.length > MAX_BYTES && trimmed.length > 0) {
    trimmed = trimmed.slice(1);
    json = JSON.stringify(trimmed);
  }
  try {
    localStorage.setItem(STORAGE_KEY(origin), json);
  } catch {
    // Quota exceeded — silently drop oldest
  }
}

export function clearHistory(origin = location.origin): void {
  localStorage.removeItem(STORAGE_KEY(origin));
}

export function exportHistory(origin = location.origin): ConversationEntry[] {
  return loadHistory(origin);
}
