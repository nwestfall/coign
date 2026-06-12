/**
 * IIFE + queue-replay loader pattern.
 *
 * Before the SDK loads, `window.Coign` is a stub that pushes calls into
 * `window.Coign.q`. After the SDK loads it replaces the stub with the real API
 * and replays the queue in order.
 *
 * Phase 2 deliverable.
 */

import { checkSupport } from './core/capabilities.js';
import { getIsLoading } from './core/engine.js';

export interface QueuedCall {
  method: string;
  args: any[];
}

export interface GlobalAPI extends Record<string, any> {
  _ready: boolean;
  _callbacks: Array<(api: GlobalAPI) => void>;
}

/**
 * Create the stub function that runs before the SDK loads.
 * Any call made to this function is pushed into `window.Coign.q`.
 */
export function createStub(): (...args: any[]) => void {
  const stubFn = function stub(this: any) {
    const w = window as any;
    w.Coign.q = w.Coign.q || [];
    w.Coign.q.push(arguments);
    const cmd = arguments[0];
    if (cmd === 'ask') {
      console.warn('[Coign] ask() was called before the SDK finished loading. The question will be queued and sent once init completes.');
    }
  } as any;

  // Expose capability check on stub so host apps can probe early
  stubFn.checkSupport = () => ({
    supported: false,
    reason: 'SDK not loaded yet. Add the Coign script tag and call Coign.init() once it loads.',
    webgpu: false,
    browser: 'unknown',
    estimatedVramMb: undefined,
  });

  stubFn.isLoading = () => true;

  return stubFn;
}

/**
 * Create the real `window.Coign` function that dispatches to the SDK API.
 * Supports both command calls (`Coign('init', config)`) and callback
 * registration (`Coign(fn)`).
 */
export function createRealAPI(api: GlobalAPI): (...args: any[]) => any {
  const realFn = function realAPI(
    command: string | ((api: GlobalAPI) => void),
    ...args: any[]
  ) {
    if (typeof command === 'function') {
      if (api._ready) {
        try {
          command(api);
        } catch (e) {
          console.error('[Coign] Callback error:', e);
        }
      } else {
        api._callbacks.push(command);
      }
      return;
    }

    const method = api[command];
    if (typeof method === 'function') {
      return method.apply(api, args);
    }

    console.warn(`[Coign] Unknown command: ${command}`);
  } as any;

  realFn.checkSupport = checkSupport;
  realFn.isLoading = () => getIsLoading();

  return realFn;
}

/**
 * Replay all queued calls from `window.Coign.q` against the real API.
 * Calls are replayed in order. If an 'init' call is encountered, subsequent
 * calls are chained after the init promise resolves.
 */
export function replayQueue(api: GlobalAPI): Promise<void> {
  const w = window as any;
  const queue: Array<IArguments> =
    w.Coign && w.Coign.q ? w.Coign.q.slice() : [];
  w.Coign.q = [];

  let chain: Promise<any> = Promise.resolve();

  for (const args of queue) {
    const cmd = args[0];
    const rest = Array.from(args).slice(1);

    if (typeof cmd === 'function') {
      chain = chain.then(() => {
        if (api._ready) {
          try {
            cmd(api);
          } catch (e) {
            console.error('[Coign] Callback error:', e);
          }
        } else {
          api._callbacks.push(cmd);
        }
      });
    } else if (cmd === 'init') {
      chain = chain.then(() => api.init(...rest));
    } else {
      chain = chain.then(() => {
        const method = api[cmd];
        if (typeof method === 'function') {
          return method.apply(api, rest);
        }
        console.warn(`[Coign] Unknown command: ${cmd}`);
      });
    }
  }

  return chain;
}

/**
 * Reset the queue state. Called by `destroy()` so that a fresh `init()`
 * can be performed later.
 */
export function resetQueueState(api: GlobalAPI): void {
  api._ready = false;
  api._callbacks = [];
  const w = window as any;
  if (w.Coign) {
    w.Coign.q = [];
  }
}
