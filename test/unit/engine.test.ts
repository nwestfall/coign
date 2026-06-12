/**
 * Unit tests for the WebLLM engine wrapper.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock @mlc-ai/web-llm before importing engine
vi.mock('@mlc-ai/web-llm', async () => {
  const actual = await vi.importActual<typeof import('@mlc-ai/web-llm')>('@mlc-ai/web-llm');
  return {
    ...actual,
    CreateMLCEngine: vi.fn(),
  };
});

import { initEngine, destroyEngine, cancelEngineInit, getIsLoading } from '../../src/core/engine.js';
import { on } from '../../src/events.js';
import * as webllm from '@mlc-ai/web-llm';

function mockEngine() {
  return {
    chat: { completions: { create: vi.fn() } },
    unload: vi.fn(),
  };
}

describe('engine', () => {
  beforeEach(() => {
    destroyEngine();
    vi.clearAllMocks();
  });

  afterEach(() => {
    destroyEngine();
  });

  /* ------------------------------------------------------------------ */
  /*  Progress emission                                                 */
  /* ------------------------------------------------------------------ */

  it('emits downloadStart at the beginning of init', async () => {
    const startSpy = vi.fn();
    const unsub = on('downloadStart', startSpy);

    (webllm.CreateMLCEngine as any).mockImplementation(
      async (_model: string, { initProgressCallback }: any) => {
        initProgressCallback?.({ progress: 1, text: 'Finish loading on all workers' });
        return mockEngine();
      }
    );

    await initEngine({ model: 'coign-tiny', prompt: 'test', modelUrl: 'https://example.com/model' } as any);

    expect(startSpy).toHaveBeenCalledTimes(1);
    unsub();
  });

  it('emits downloadProgress with mapped stages', async () => {
    const progressSpy = vi.fn();
    const unsub = on('downloadProgress', progressSpy);

    (webllm.CreateMLCEngine as any).mockImplementation(
      async (_model: string, { initProgressCallback }: any) => {
        initProgressCallback?.({ progress: 0, text: 'Fetching param cache from wasm preprocessing' });
        initProgressCallback?.({ progress: 0.3, text: 'Loading model from cache' });
        initProgressCallback?.({ progress: 0.6, text: 'Loading GPU shaders' });
        initProgressCallback?.({ progress: 1, text: 'Finish loading on all workers' });
        return mockEngine();
      }
    );

    await initEngine({ model: 'coign-tiny', prompt: 'test', modelUrl: 'https://example.com/model' } as any);

    expect(progressSpy).toHaveBeenCalledTimes(4);

    const stages = progressSpy.mock.calls.map((call) => (call[0] as any).stage);
    expect(stages).toEqual([
      'checking-cache',
      'checking-cache',
      'downloading',
      'ready',
    ]);

    unsub();
  });

  it('emits downloadComplete when init finishes', async () => {
    const completeSpy = vi.fn();
    const unsub = on('downloadComplete', completeSpy);

    (webllm.CreateMLCEngine as any).mockImplementation(
      async (_model: string, { initProgressCallback }: any) => {
        initProgressCallback?.({ progress: 1, text: 'Finish loading on all workers' });
        return mockEngine();
      }
    );

    await initEngine({ model: 'coign-tiny', prompt: 'test', modelUrl: 'https://example.com/model' } as any);

    expect(completeSpy).toHaveBeenCalledTimes(1);
    unsub();
  });

  it('emits ready after init succeeds', async () => {
    const readySpy = vi.fn();
    const unsub = on('ready', readySpy);

    (webllm.CreateMLCEngine as any).mockImplementation(
      async (_model: string, { initProgressCallback }: any) => {
        initProgressCallback?.({ progress: 1, text: 'Finish loading on all workers' });
        return mockEngine();
      }
    );

    await initEngine({ model: 'coign-tiny', prompt: 'test', modelUrl: 'https://example.com/model' } as any);

    expect(readySpy).toHaveBeenCalledTimes(1);
    unsub();
  });

  /* ------------------------------------------------------------------ */
  /*  Cancellation                                                      */
  /* ------------------------------------------------------------------ */

  it('allows cancelling init before engine resolves', async () => {
    (webllm.CreateMLCEngine as any).mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve(mockEngine()), 200))
    );

    const initPromise = initEngine({ model: 'coign-tiny', prompt: 'test', modelUrl: 'https://example.com/model' } as any);

    // Cancel immediately
    cancelEngineInit();

    await expect(initPromise).rejects.toThrow('cancelled');
    expect(getIsLoading()).toBe(false);
  });

  /* ------------------------------------------------------------------ */
  /*  Error handling                                                    */
  /* ------------------------------------------------------------------ */

  it('emits downloadError when CreateMLCEngine throws', async () => {
    (webllm.CreateMLCEngine as any).mockRejectedValue(new Error('network failure'));

    const errorSpy = vi.fn();
    const unsub = on('downloadError', errorSpy);

    await expect(
      initEngine({ model: 'coign-tiny', prompt: 'test', modelUrl: 'https://example.com/model' } as any)
    ).rejects.toThrow('network failure');

    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy.mock.calls[0][0].message).toContain('network failure');
    unsub();
  });

  it('exposes getIsLoading during init', async () => {
    expect(getIsLoading()).toBe(false);

    (webllm.CreateMLCEngine as any).mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve(mockEngine()), 50))
    );

    const initPromise = initEngine({ model: 'coign-tiny', prompt: 'test', modelUrl: 'https://example.com/model' } as any);
    expect(getIsLoading()).toBe(true);

    await initPromise;
    expect(getIsLoading()).toBe(false);
  });
});
