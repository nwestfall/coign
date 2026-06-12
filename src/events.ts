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
  if (!set) return;
  set.forEach((h) => {
    try {
      h(payload);
    } catch (e) {
      // Intentionally swallow — no uncaught exceptions from event handlers
      console.error(`Coign event handler error for "${event}":`, e);
    }
  });
}

export function clearAllListeners(): void {
  listeners.clear();
}
