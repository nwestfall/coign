import { describe, it, expect, vi } from 'vitest';
import { on, emit, clearAllListeners } from '../../src/events.js';

describe('on / emit', () => {
  beforeEach(() => {
    clearAllListeners();
  });

  it('emits events to registered listeners', () => {
    const handler = vi.fn();
    on('ready', handler);
    emit('ready', {});
    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith({});
  });

  it('supports multiple listeners for the same event', () => {
    const handler1 = vi.fn();
    const handler2 = vi.fn();
    on('ask', handler1);
    on('ask', handler2);
    emit('ask', { question: 'hello' });
    expect(handler1).toHaveBeenCalledWith({ question: 'hello' });
    expect(handler2).toHaveBeenCalledWith({ question: 'hello' });
  });

  it('returns an unsubscribe function', () => {
    const handler = vi.fn();
    const unsub = on('ready', handler);
    unsub();
    emit('ready', {});
    expect(handler).not.toHaveBeenCalled();
  });

  it('does not throw when emitting with no listeners', () => {
    expect(() => emit('error', { kind: 'init', message: 'test' } as any)).not.toThrow();
  });

  it('swallows errors in handlers', () => {
    const badHandler = vi.fn(() => {
      throw new Error('boom');
    });
    const goodHandler = vi.fn();
    on('ready', badHandler);
    on('ready', goodHandler);
    expect(() => emit('ready', {})).not.toThrow();
    expect(badHandler).toHaveBeenCalled();
    expect(goodHandler).toHaveBeenCalled();
  });

  it('supports all event types', () => {
    const handlers: Record<string, ReturnType<typeof vi.fn>> = {};
    const events = ['load', 'ready', 'error', 'ask', 'answer', 'warn', 'toolCall', 'toolResult', 'unregister'] as const;

    for (const event of events) {
      handlers[event] = vi.fn();
      on(event, handlers[event]);
    }

    emit('load', { progress: 0.5, text: 'loading' });
    emit('ready', {});
    emit('error', { kind: 'init', message: 'fail' } as any);
    emit('ask', { question: 'q' });
    emit('answer', { answer: 'a', toolCalls: [], durationMs: 100 });
    emit('warn', { message: 'w', kind: 'overflow' });
    emit('toolCall', { name: 'n', args: {} });
    emit('toolResult', { name: 'n', result: {}, durationMs: 50 });
    emit('unregister', { name: 'n' });

    for (const event of events) {
      expect(handlers[event]).toHaveBeenCalledOnce();
    }
  });
});

describe('clearAllListeners', () => {
  it('removes all listeners', () => {
    const handler = vi.fn();
    on('ready', handler);
    clearAllListeners();
    emit('ready', {});
    expect(handler).not.toHaveBeenCalled();
  });
});
