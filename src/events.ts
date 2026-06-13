/**
 * Typed pub/sub event bus for the SDK.
 */

import type { CoignEvent, CoignEventPayload } from './types.js';

type Handler<T extends CoignEvent> = (payload: CoignEventPayload[T]) => void;

const listeners: Map<CoignEvent, Set<Handler<any>>> = new Map();

export function on<T extends CoignEvent>(event: T, handler: Handler<T>): () => void {
  if (!listeners.has(event)) {
    listeners.set(event, new Set());
  }
  const set = listeners.get(event)!;
  set.add(handler);
  return () => {
    set.delete(handler);
  };
}

export function emit<T extends CoignEvent>(event: T, payload: CoignEventPayload[T]): void {
  const set = listeners.get(event);
  if (set) {
    set.forEach((h) => {
      try {
        h(payload);
      } catch (e) {
        // Intentionally swallow — no uncaught exceptions from event handlers
        console.error(`Coign event handler error for "${event}":`, e);
      }
    });
  }

  // Dispatch DOM custom event so external listeners (e.g. demo page) can observe
  if (typeof document !== 'undefined') {
    try {
      document.dispatchEvent(new CustomEvent(`coign:${event}`, { detail: payload }));
    } catch {
      // ignore
    }
  }
}

export function clearAllListeners(): void {
  listeners.clear();
}
