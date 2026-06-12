/**
 * Coign SDK — public API entry point.
 */

import type { CoignConfig, CoignSDK, ToolDefinition, CoignEvent } from './types.js';
import { initEngine, destroyEngine } from './core/engine.js';
import { resolvePreset } from './core/presets.js';
import { buildPageOutline, outlineToMarkdown } from './core/context.js';
import { registerBuiltin, registerHost, setHostNamespace } from './tools/registry.js';
import { searchPageTool } from './tools/built-in/search-page.js';
import { getPageOutlineTool } from './tools/built-in/get-outline.js';
import { getElementTool } from './tools/built-in/get-element.js';
import { runManualToolLoop, buildSystemPrompt } from './llm/manual-tool-loop.js';
import { emit, on } from './events.js';
import { patchConfig, resetConfig, getConfig } from './config.js';
import { loadHistory, saveHistory, clearHistory, exportHistory } from './store/history.js';
import { outlineStore } from './store/outline-store.js';
import {
  createWidget,
  destroyWidget,
  showWidget,
  hideWidget,
  openPanel,
  closePanel,
  mountInline,
  unmountInline,
  addAssistantMessage,
  addToolCallMessage,
  addToolResultMessage,
  applyTheme,
} from './ui/widget.js';
import { createRealAPI, replayQueue, resetQueueState, type GlobalAPI } from './queue-loader.js';

declare const __VERSION__: string;

export const VERSION = typeof __VERSION__ !== 'undefined' ? __VERSION__ : '0.1.0';

let sdkInstance: CoignSDK | null = null;
let initialized = false;
let eventUnsubs: Array<() => void> = [];
let api: GlobalAPI;

function createSDK(_config: CoignConfig): CoignSDK {
  const history: import('./types.js').ConversationEntry[] = loadHistory();

  return {
    async ask(question: string): Promise<string> {
      emit('ask', { question });
      const start = performance.now();
      const currentConfig = getConfig();
      const outline = outlineStore.get('current') ?? buildPageOutline(currentConfig.selectDOM ?? 'main, [role="main"], article');

      const messages: import('@mlc-ai/web-llm').ChatCompletionMessageParam[] = [
        { role: 'system', content: buildSystemPrompt((currentConfig.prompt ?? '') + '\n\n' + outlineToMarkdown(outline)) },
        ...history.map((h) => ({ role: h.role as any, content: h.content })),
        { role: 'user', content: question },
      ];

      const { answer, toolCalls } = await runManualToolLoop(messages);
      const durationMs = Math.round(performance.now() - start);

      history.push({ role: 'user', content: question, timestamp: Date.now() });
      history.push({ role: 'assistant', content: answer, toolCalls, timestamp: Date.now() });
      if (currentConfig.persistHistory !== false) {
        saveHistory(history);
      }

      emit('answer', { answer, toolCalls, durationMs });
      return answer;
    },

    update(patch) {
      patchConfig(patch);
    },

    destroy() {
      eventUnsubs.forEach((unsub) => unsub());
      eventUnsubs = [];
      destroyEngine();
      destroyWidget();
      resetConfig();
      sdkInstance = null;
      initialized = false;
    },

    show() {
      showWidget();
    },

    hide() {
      hideWidget();
    },

    open() {
      openPanel();
    },

    close() {
      closePanel();
    },

    mount(selector) {
      mountInline(selector);
    },

    unmount() {
      unmountInline();
    },

    tool(def) {
      return registerHost(def);
    },

    on(event, cb) {
      return on(event as CoignEvent, cb);
    },

    config(patch) {
      patchConfig(patch);
    },

    clearHistory() {
      clearHistory();
    },

    exportHistory() {
      return exportHistory();
    },

    version: VERSION,
  };
}

export async function init(config: CoignConfig): Promise<CoignSDK> {
  if (initialized && sdkInstance) {
    return sdkInstance;
  }

  const resolvedModel = resolvePreset(config.model);

  await initEngine({ ...config, model: resolvedModel });
  setHostNamespace(location.origin);

  // Register built-in tools
  registerBuiltin('searchPage', searchPageTool);
  registerBuiltin('getPageOutline', getPageOutlineTool);
  registerBuiltin('getElement', getElementTool);

  // Build outline store (never tier)
  const outline = buildPageOutline(config.selectDOM ?? 'main, [role="main"], article');
  outlineStore.set('current', outline);

  sdkInstance = createSDK({ ...config, model: resolvedModel });
  initialized = true;

  // Create widget UI
  createWidget({ ...config, model: resolvedModel }, (question) => {
    sdkInstance!.ask(question);
  });

  // Wire widget to SDK events
  eventUnsubs.push(
    on('answer', ({ answer }) => addAssistantMessage(answer)),
    on('toolCall', ({ name, args }) => addToolCallMessage(name, JSON.stringify(args))),
    on('toolResult', ({ name, result }) => addToolResultMessage(name, JSON.stringify(result)))
  );

  // Wire config callbacks to events
  if (config.onLoad) on('load', config.onLoad);
  if (config.onReady) on('ready', config.onReady);
  if (config.onError) on('error', config.onError);
  if (config.onAsk) on('ask', config.onAsk);
  if (config.onAnswer) on('answer', config.onAnswer);
  if (config.onWarn) on('warn', config.onWarn);
  if (config.onToolCall) on('toolCall', config.onToolCall);
  if (config.onToolResult) on('toolResult', config.onToolResult);

  // Mark API ready and flush callbacks
  if (api) {
    api._ready = true;
    const cbs = api._callbacks.slice();
    api._callbacks = [];
    cbs.forEach((cb) => {
      try {
        cb(api);
      } catch (e) {
        console.error('[Coign] Callback error:', e);
      }
    });
  }

  return sdkInstance;
}

export function tool(def: ToolDefinition): () => void {
  return registerHost(def);
}

export async function ask(question: string): Promise<string> {
  if (!sdkInstance) {
    throw new Error('Coign not initialized. Call Coign.init() first.');
  }
  return sdkInstance.ask(question);
}

export function destroy(): void {
  sdkInstance?.destroy();
  if (api) {
    resetQueueState(api);
  }
}

export function mount(selector: string): void {
  sdkInstance?.mount(selector);
}

export function unmount(): void {
  sdkInstance?.unmount();
}

export function show(): void {
  sdkInstance?.show();
}

export function hide(): void {
  sdkInstance?.hide();
}

export function open(): void {
  sdkInstance?.open();
}

export function close(): void {
  sdkInstance?.close();
}

export function config(patch: Partial<CoignConfig>): void {
  patchConfig(patch);
  sdkInstance?.update(patch);
  if (patch.theme) {
    applyTheme(patch.theme);
  }
}

export { on };

export { clearHistory, exportHistory };

export { VERSION as version };

// --- Global API object for IIFE / queue-replay ---

api = {
  _ready: false,
  _callbacks: [],
  init,
  ask,
  tool,
  destroy,
  mount,
  unmount,
  show,
  hide,
  open,
  close,
  config,
  on,
  clearHistory,
  exportHistory,
  version: VERSION,
};

const realAPI = createRealAPI(api);
Object.assign(realAPI, api);

// Auto-replay queue when loaded in a browser
if (typeof window !== 'undefined') {
  const w = window as any;
  // Only replace if not already the real SDK
  if (!w.Coign || !w.Coign.version) {
    // Capture any existing queue from the stub
    const existingQueue = w.Coign && w.Coign.q ? w.Coign.q.slice() : [];
    w.Coign = realAPI;
    if (existingQueue.length > 0) {
      w.Coign.q = existingQueue;
      replayQueue(api);
    }
  }
}

export default realAPI;
