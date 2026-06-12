/**
 * Unit tests for browser capability detection.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  isWebGPUSupported,
  requestGPUAdapter,
  estimateVramMb,
  getBrowser,
  checkSupport,
} from '../../src/core/capabilities.js';

describe('capabilities', () => {
  let originalNavigator: any;

  beforeEach(() => {
    originalNavigator = (globalThis as any).navigator;
  });

  afterEach(() => {
    (globalThis as any).navigator = originalNavigator;
  });

  /* ------------------------------------------------------------------ */
  /*  isWebGPUSupported                                                 */
  /* ------------------------------------------------------------------ */

  it('returns false when navigator is undefined', () => {
    (globalThis as any).navigator = undefined;
    expect(isWebGPUSupported()).toBe(false);
  });

  it('returns false when gpu is missing', () => {
    (globalThis as any).navigator = { userAgent: 'Chrome/120' };
    expect(isWebGPUSupported()).toBe(false);
  });

  it('returns false when requestAdapter is missing', () => {
    (globalThis as any).navigator = { gpu: {} };
    expect(isWebGPUSupported()).toBe(false);
  });

  it('returns true when gpu.requestAdapter exists', () => {
    (globalThis as any).navigator = {
      gpu: { requestAdapter: () => Promise.resolve({}) },
    };
    expect(isWebGPUSupported()).toBe(true);
  });

  /* ------------------------------------------------------------------ */
  /*  requestGPUAdapter                                                 */
  /* ------------------------------------------------------------------ */

  it('returns null when WebGPU is unsupported', async () => {
    (globalThis as any).navigator = { userAgent: 'Chrome/120' };
    expect(await requestGPUAdapter()).toBeNull();
  });

  it('returns adapter when requestAdapter succeeds', async () => {
    const adapter = { limits: { maxBufferSize: 1024 * 1024 * 1024 } };
    (globalThis as any).navigator = {
      gpu: { requestAdapter: () => Promise.resolve(adapter) },
    };
    expect(await requestGPUAdapter()).toBe(adapter);
  });

  it('returns null when requestAdapter throws', async () => {
    (globalThis as any).navigator = {
      gpu: { requestAdapter: () => Promise.reject(new Error('fail')) },
    };
    expect(await requestGPUAdapter()).toBeNull();
  });

  /* ------------------------------------------------------------------ */
  /*  estimateVramMb                                                    */
  /* ------------------------------------------------------------------ */

  it('returns undefined for null adapter', () => {
    expect(estimateVramMb(null)).toBeUndefined();
  });

  it('returns undefined when limits are absent', () => {
    expect(estimateVramMb({})).toBeUndefined();
  });

  it('computes MB from maxBufferSize', () => {
    const adapter = { limits: { maxBufferSize: 1024 * 1024 * 1024 } };
    expect(estimateVramMb(adapter)).toBe(1024);
  });

  it('falls back to maxStorageBufferBindingSize', () => {
    const adapter = { limits: { maxStorageBufferBindingSize: 512 * 1024 * 1024 } };
    expect(estimateVramMb(adapter)).toBe(512);
  });

  /* ------------------------------------------------------------------ */
  /*  getBrowser                                                        */
  /* ------------------------------------------------------------------ */

  it('returns unknown when navigator is undefined', () => {
    (globalThis as any).navigator = undefined;
    expect(getBrowser()).toBe('unknown');
  });

  it('detects Chrome', () => {
    (globalThis as any).navigator = { userAgent: 'Mozilla/5.0 Chrome/120' };
    expect(getBrowser()).toBe('Chrome');
  });

  it('detects Edge', () => {
    (globalThis as any).navigator = { userAgent: 'Mozilla/5.0 Edg/120' };
    expect(getBrowser()).toBe('Edge');
  });

  it('detects Safari', () => {
    (globalThis as any).navigator = { userAgent: 'Mozilla/5.0 Safari/600' };
    expect(getBrowser()).toBe('Safari');
  });

  it('detects Firefox', () => {
    (globalThis as any).navigator = { userAgent: 'Mozilla/5.0 Firefox/120' };
    expect(getBrowser()).toBe('Firefox');
  });

  /* ------------------------------------------------------------------ */
  /*  checkSupport                                                      */
  /* ------------------------------------------------------------------ */

  it('reports unsupported when WebGPU is absent', async () => {
    (globalThis as any).navigator = { userAgent: 'Chrome/120' };
    const result = await checkSupport();
    expect(result.supported).toBe(false);
    expect(result.webgpu).toBe(false);
    expect(result.browser).toBe('Chrome');
    expect(result.reason).toContain('WebGPU is not available');
  });

  it('reports unsupported when adapter fails', async () => {
    (globalThis as any).navigator = {
      userAgent: 'Chrome/120',
      gpu: { requestAdapter: () => Promise.reject(new Error('fail')) },
    };
    const result = await checkSupport();
    expect(result.supported).toBe(false);
    expect(result.webgpu).toBe(true);
    expect(result.reason).toContain('adapter');
  });

  it('reports supported with VRAM when adapter succeeds', async () => {
    (globalThis as any).navigator = {
      userAgent: 'Chrome/120',
      gpu: {
        requestAdapter: () =>
          Promise.resolve({ limits: { maxBufferSize: 1024 * 1024 * 1024 } }),
      },
    };
    const result = await checkSupport();
    expect(result.supported).toBe(true);
    expect(result.webgpu).toBe(true);
    expect(result.estimatedVramMb).toBe(1024);
  });

  it('warns when VRAM is very low', async () => {
    (globalThis as any).navigator = {
      userAgent: 'Chrome/120',
      gpu: {
        requestAdapter: () =>
          Promise.resolve({ limits: { maxBufferSize: 256 * 1024 * 1024 } }),
      },
    };
    const result = await checkSupport();
    expect(result.supported).toBe(true);
    expect(result.reason).toContain('256 MB');
  });
});
