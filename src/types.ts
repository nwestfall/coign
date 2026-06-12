/**
 * Coign SDK — TypeScript source of truth.
 * Mirrors the type definitions in tool-catalog.md §TypeScript surface.
 */

export interface CoignConfig {
  model: string;
  prompt: string;
  selectDOM?: string;
  preloadMode?: 'full' | 'outline' | 'none';
  position?: 'bottom-right' | 'bottom-left';
  theme?: CoignTheme;
  welcome?: string | { message: string; suggestions?: string[] };
  modelUrl?: string;
  tools?: ToolDefinition[];
  toolChoice?: 'auto' | 'required' | { type: 'function'; name: string };
  autoApprove?: Array<'read' | 'write' | 'destructive'>;
  persistHistory?: boolean;
  cacheBackend?: 'cache' | 'indexeddb' | 'opfs' | 'cross-origin'; // default: 'indexeddb'
  toolTimeoutMs?: number;
  onLoad?: (p: { progress: number; text: string }) => void;
  onReady?: () => void;
  onError?: (e: CoignError) => void;
  onAsk?: (q: { question: string }) => void;
  onAnswer?: (a: { answer: string; toolCalls: ToolCall[]; durationMs: number }) => void;
  onWarn?: (w: { message: string; kind: 'injection' | 'overflow' | 'fallback' | 'no_such_tool' }) => void;
  onToolCall?: (t: { name: string; args: any }) => void;
  onToolResult?: (t: { name: string; result: any; durationMs: number }) => void;
}

export interface CoignTheme {
  accent?: string;
  text?: string;
  bg?: string;
  radius?: number;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, any>;
  risk?: 'read' | 'write' | 'destructive';
  execute: (args: any) => any | Promise<any>;
  confirmMessage?: (args: any) => string;
}

export type CoignEvent =
  | 'load'
  | 'ready'
  | 'error'
  | 'ask'
  | 'answer'
  | 'warn'
  | 'toolCall'
  | 'toolResult'
  | 'unregister';

export type CoignEventPayload = {
  load: { progress: number; text: string };
  ready: Record<string, never>;
  error: CoignError;
  ask: { question: string };
  answer: { answer: string; toolCalls: ToolCall[]; durationMs: number };
  warn: { message: string; kind: 'injection' | 'overflow' | 'fallback' | 'no_such_tool' };
  toolCall: { name: string; args: any };
  toolResult: { name: string; result: any; durationMs: number };
  unregister: { name: string };
};

export interface CoignSDK {
  ask(question: string): Promise<string>;
  update(patch: Partial<CoignConfig>): void;
  destroy(): void;
  show(): void;
  hide(): void;
  open(): void;
  close(): void;
  mount(selector: string): void;
  unmount(): void;
  tool(def: ToolDefinition): () => void;
  on(event: CoignEvent, cb: (payload: any) => void): () => void;
  config(patch: Partial<CoignConfig>): void;
  clearHistory(): void;
  exportHistory(): ConversationEntry[];
  version: string;
}

export interface CoignError extends Error {
  kind: 'init' | 'tool' | 'model' | 'network' | 'config' | 'browser_unsupported';
}

export interface ToolCall {
  name: string;
  args: Record<string, any>;
}

export interface ConversationEntry {
  role: 'user' | 'assistant' | 'tool';
  content: string;
  toolCalls?: ToolCall[];
  timestamp: number;
}

// Tool I/O types (from tool-catalog.md)
export interface SearchPageArgs {
  query: string;
  scope?: string;
  maxResults?: number;
  contextTokens?: number;
  matchMode?: 'any' | 'all' | 'phrase';
  caseSensitive?: boolean;
  fields?: Array<'text' | 'headings' | 'links' | 'alt'>;
}

export interface SearchHit {
  score: number;
  snippet: string;
  source: {
    selector: string;
    headingPath: string[];
    charStart: number;
  };
}

export interface SearchPageResult {
  query: string;
  totalMatches: number;
  returned: number;
  hits: SearchHit[];
  truncated: boolean;
  hint?: 'no_matches' | 'too_broad' | 'wrong_scope';
}

export interface GetPageOutlineArgs {
  refresh?: boolean;
}

export interface PageOutline {
  title: string;
  url: string;
  headings: Array<{ level: 1 | 2 | 3; text: string; id?: string }>;
  landmarks: Array<{ role: string; label?: string; selector: string }>;
  links: Array<{ text: string; href: string; rel?: string }>;
  structuredData: Array<{ type: string; data: unknown }>;
  openGraph: Record<string, string>;
  forms: Array<{
    selector: string;
    action: string;
    fields: Array<{ name: string; type: string; required: boolean }>;
  }>;
  tokenEstimate: number;
}

export interface GetElementArgs {
  selector: string;
  includeHidden?: boolean;
  maxHtmlBytes?: number;
}

export interface GetElementResult {
  found: boolean;
  selector: string;
  text: string;
  html: string;
  attributes: Record<string, string>;
  boundingRect?: { x: number; y: number; w: number; h: number };
  inViewport: boolean;
}
