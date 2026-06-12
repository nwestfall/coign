import { describe, it, expect, beforeEach } from 'vitest';
import {
  createStub,
  createRealAPI,
  replayQueue,
  resetQueueState,
  type GlobalAPI,
} from '../../src/queue-loader.js';

describe('createStub', () => {
  beforeEach(() => {
    (globalThis as any).window = { Coign: {} };
  });

  it('pushes calls into window.Coign.q', () => {
    const stub = createStub();
    stub('init', { model: 'test' });
    stub('config', { theme: {} });
    const q = (globalThis as any).window.Coign.q;
    expect(q).toHaveLength(2);
    expect(q[0][0]).toBe('init');
    expect(q[1][0]).toBe('config');
  });

  it('creates the queue if it does not exist', () => {
    delete (globalThis as any).window.Coign.q;
    const stub = createStub();
    stub('init');
    expect((globalThis as any).window.Coign.q).toHaveLength(1);
  });
});

describe('createRealAPI', () => {
  it('dispatches command calls to the API', () => {
    const api: GlobalAPI = {
      _ready: false,
      _callbacks: [],
      init: vi.fn().mockResolvedValue(undefined),
      ask: vi.fn(),
    } as any;

    const real = createRealAPI(api);
    real('init', { model: 'test' });
    expect(api.init).toHaveBeenCalledWith({ model: 'test' });
  });

  it('warns on unknown commands', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const api: GlobalAPI = { _ready: false, _callbacks: [] } as any;
    const real = createRealAPI(api);
    real('unknown');
    expect(warnSpy).toHaveBeenCalledWith('[Coign] Unknown command: unknown');
    warnSpy.mockRestore();
  });

  it('queues callback functions when not ready', () => {
    const api: GlobalAPI = { _ready: false, _callbacks: [] } as any;
    const real = createRealAPI(api);
    const cb = vi.fn();
    real(cb);
    expect(api._callbacks).toContain(cb);
  });

  it('fires callbacks immediately when ready', () => {
    const cb = vi.fn();
    const api: GlobalAPI = { _ready: true, _callbacks: [] } as any;
    const real = createRealAPI(api);
    real(cb);
    expect(cb).toHaveBeenCalledWith(api);
  });
});

function makeArgs(...items: any[]): IArguments {
  return items as unknown as IArguments;
}

describe('replayQueue', () => {
  beforeEach(() => {
    (globalThis as any).window = { Coign: { q: [] } };
  });

  it('replays queued calls in order', async () => {
    const api: GlobalAPI = {
      _ready: false,
      _callbacks: [],
      init: vi.fn().mockResolvedValue(undefined),
      config: vi.fn(),
    } as any;

    (globalThis as any).window.Coign.q = [
      makeArgs('config', { theme: {} }),
      makeArgs('init', { model: 'test' }),
    ];

    await replayQueue(api);
    expect(api.config).toHaveBeenCalledWith({ theme: {} });
    expect(api.init).toHaveBeenCalledWith({ model: 'test' });
  });

  it('chains init calls before subsequent commands', async () => {
    const api: GlobalAPI = {
      _ready: false,
      _callbacks: [],
      init: vi.fn().mockResolvedValue('sdk'),
      ask: vi.fn(),
    } as any;

    (globalThis as any).window.Coign.q = [
      { 0: 'init', 1: { model: 'test' } },
      { 0: 'ask', 1: 'hello' },
    ];

    await replayQueue(api);
    expect(api.init).toHaveBeenCalledBefore(api.ask as any);
  });

  it('clears the queue after replay', async () => {
    const api: GlobalAPI = { _ready: false, _callbacks: [], init: vi.fn() } as any;
    (globalThis as any).window.Coign.q = [makeArgs('init')];
    await replayQueue(api);
    expect((globalThis as any).window.Coign.q).toHaveLength(0);
  });
});

describe('resetQueueState', () => {
  it('resets ready flag and callbacks', () => {
    const api: GlobalAPI = { _ready: true, _callbacks: [() => {}] } as any;
    (globalThis as any).window = { Coign: { q: [{ 0: 'init' }] } };
    resetQueueState(api);
    expect(api._ready).toBe(false);
    expect(api._callbacks).toHaveLength(0);
    expect((globalThis as any).window.Coign.q).toHaveLength(0);
  });
});
