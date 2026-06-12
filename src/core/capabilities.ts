/**
 * Browser capability detection for Coign SDK.
 *
 * Detects WebGPU support, browser identification, and rough VRAM estimates
 * so developers can check support before calling init() and present
 * meaningful fallback UI to users.
 */

import type { SupportCheck } from '../types.js';

/**
 * Check whether the current browser supports WebGPU.
 */
export function isWebGPUSupported(): boolean {
  if (typeof navigator === 'undefined') return false;
  return 'gpu' in navigator && typeof (navigator as any).gpu?.requestAdapter === 'function';
}

/**
 * Request a WebGPU adapter to probe hardware capabilities.
 * Returns null if WebGPU is unavailable or the adapter can't be created.
 */
export async function requestGPUAdapter(): Promise<any | null> {
  if (!isWebGPUSupported()) return null;
  try {
    return await (navigator as any).gpu.requestAdapter();
  } catch {
    return null;
  }
}

/**
 * Get a rough VRAM estimate (in MB) from the GPU adapter.
 * This is a best-effort heuristic; not all adapters expose limits.
 */
export function estimateVramMb(adapter: any | null): number | undefined {
  if (!adapter) return undefined;
  const limits = (adapter as any).limits;
  if (!limits) return undefined;

  // Heuristic: if maxBufferSize is exposed, divide by ~1.5 MB per "unit"
  // This is intentionally conservative.
  const maxBufferSize = limits.maxBufferSize ?? limits.maxStorageBufferBindingSize;
  if (typeof maxBufferSize === 'number') {
    return Math.round(maxBufferSize / (1024 * 1024));
  }
  return undefined;
}

/**
 * Identify the current browser from the user-agent string.
 */
export function getBrowser(): string {
  if (typeof navigator === 'undefined') return 'unknown';
  const ua = navigator.userAgent;

  if (ua.includes('Edg/')) return 'Edge';
  if (ua.includes('Chrome/') && !ua.includes('Edg/')) return 'Chrome';
  if (ua.includes('Safari/') && !ua.includes('Chrome/')) return 'Safari';
  if (ua.includes('Firefox/')) return 'Firefox';
  if (ua.includes('Opera/') || ua.includes('OPR/')) return 'Opera';
  return 'unknown';
}

/**
 * Comprehensive support check.
 *
 * Returns whether Coign can run on this browser and, if not, why.
 * Also returns browser name and a best-effort VRAM estimate.
 */
export async function checkSupport(): Promise<SupportCheck> {
  const browser = getBrowser();

  if (!isWebGPUSupported()) {
    return {
      supported: false,
      reason: 'WebGPU is not available in this browser. Coign requires WebGPU to run models locally. Try Chrome 113+, Edge 113+, or Firefox Nightly.',
      webgpu: false,
      browser,
    };
  }

  const adapter = await requestGPUAdapter();
  if (!adapter) {
    return {
      supported: false,
      reason: 'WebGPU adapter could not be created. This may mean the GPU is blocked (e.g. battery saver, unsupported hardware, or a virtual machine).',
      webgpu: true,
      browser,
    };
  }

  const estimatedVramMb = estimateVramMb(adapter);

  // Even if we get an adapter, warn if VRAM looks too low for the smallest preset (~400 MB)
  if (estimatedVramMb !== undefined && estimatedVramMb < 512) {
    return {
      supported: true,
      reason: `GPU reports only ~${estimatedVramMb} MB of usable memory. The smallest Coign preset (coign-tiny, ~400 MB) may fail to load.`,
      webgpu: true,
      browser,
      estimatedVramMb,
    };
  }

  return {
    supported: true,
    webgpu: true,
    browser,
    estimatedVramMb,
  };
}
