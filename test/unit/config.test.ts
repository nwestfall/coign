import { describe, it, expect, beforeEach } from 'vitest';
import { getConfig, patchConfig, resetConfig, DEFAULT_CONFIG } from '../../src/config.js';

describe('getConfig', () => {
  beforeEach(() => {
    resetConfig();
  });

  it('returns default config initially', () => {
    const config = getConfig();
    expect(config.selectDOM).toBe(DEFAULT_CONFIG.selectDOM);
    expect(config.preloadMode).toBe(DEFAULT_CONFIG.preloadMode);
    expect(config.position).toBe(DEFAULT_CONFIG.position);
    expect(config.autoApprove).toEqual(DEFAULT_CONFIG.autoApprove);
    expect(config.persistHistory).toBe(DEFAULT_CONFIG.persistHistory);
    expect(config.cacheBackend).toBe(DEFAULT_CONFIG.cacheBackend);
    expect(config.toolTimeoutMs).toBe(DEFAULT_CONFIG.toolTimeoutMs);
  });

  it('returns a frozen object', () => {
    const config = getConfig();
    expect(() => {
      (config as any).selectDOM = 'body';
    }).toThrow();
  });
});

describe('patchConfig', () => {
  beforeEach(() => {
    resetConfig();
  });

  it('overrides default values', () => {
    patchConfig({ selectDOM: 'body', toolTimeoutMs: 10000 });
    const config = getConfig();
    expect(config.selectDOM).toBe('body');
    expect(config.toolTimeoutMs).toBe(10000);
    expect(config.position).toBe('bottom-right'); // unchanged
  });

  it('merges multiple patches', () => {
    patchConfig({ selectDOM: 'body' });
    patchConfig({ position: 'bottom-left' });
    const config = getConfig();
    expect(config.selectDOM).toBe('body');
    expect(config.position).toBe('bottom-left');
  });
});

describe('resetConfig', () => {
  it('clears all patches', () => {
    patchConfig({ selectDOM: 'body' });
    resetConfig();
    const config = getConfig();
    expect(config.selectDOM).toBe(DEFAULT_CONFIG.selectDOM);
  });
});
