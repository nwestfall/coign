/**
 * Tool registry — registration, namespacing, and whitelist enforcement.
 */

import type { ToolDefinition } from '../types.js';

const BUILTIN_NAMESPACE = 'agent';
// Host namespace is replaced with origin at runtime

export class ToolRegistrationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'Coign.ToolRegistrationError';
  }
}

const tools = new Map<string, ToolDefinition>();
let hostNamespace = 'page';

export function setHostNamespace(origin: string): void {
  try {
    hostNamespace = new URL(origin).hostname.replace(/\./g, '_');
  } catch {
    hostNamespace = 'page';
  }
}

export function registerBuiltin(name: string, def: ToolDefinition): void {
  tools.set(`${BUILTIN_NAMESPACE}.${name}`, def);
}

export function registerHost(def: ToolDefinition): () => void {
  validateRegistration(def);
  const fullName = `${hostNamespace}.${def.name}`;
  tools.set(fullName, def);
  return () => {
    tools.delete(fullName);
  };
}

export function lookupTool(fullName: string): ToolDefinition | undefined {
  return tools.get(fullName);
}

export function listTools(): Array<{ fullName: string; def: ToolDefinition }> {
  return Array.from(tools.entries()).map(([fullName, def]) => ({ fullName, def }));
}

export function isKnownTool(fullName: string): boolean {
  return tools.has(fullName);
}

function validateRegistration(def: ToolDefinition): void {
  if (!def.name || def.name.length > 64 || !/^[a-zA-Z][a-zA-Z0-9_]*$/.test(def.name)) {
    throw new ToolRegistrationError(
      `Tool name must be 1–64 chars, start with a letter, and use only alphanumeric/underscore. Got: "${def.name}"`
    );
  }
  if (!def.description || def.description.length > 500) {
    throw new ToolRegistrationError(
      `Tool description is required and must be ≤ 500 chars. Got: "${def.description}"`
    );
  }
  if (!def.parameters || typeof def.parameters !== 'object') {
    throw new ToolRegistrationError('Tool parameters must be a valid JSON Schema object.');
  }
  if (typeof def.execute !== 'function') {
    throw new ToolRegistrationError('Tool execute must be a function.');
  }
}
