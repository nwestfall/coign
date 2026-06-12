import { describe, it, expect, beforeEach } from 'vitest';
import { isAutoApproved, tierLabel } from '../../src/tools/risk-tiers.js';
import { resetConfig, patchConfig } from '../../src/config.js';

describe('isAutoApproved', () => {
  beforeEach(() => {
    resetConfig();
  });

  it('auto-approves read by default', () => {
    expect(isAutoApproved('read')).toBe(true);
    expect(isAutoApproved(undefined)).toBe(true);
  });

  it('denies write and destructive by default', () => {
    expect(isAutoApproved('write')).toBe(false);
    expect(isAutoApproved('destructive')).toBe(false);
  });

  it('respects autoApprove config', () => {
    patchConfig({ autoApprove: ['read', 'write'] });
    expect(isAutoApproved('read')).toBe(true);
    expect(isAutoApproved('write')).toBe(true);
    expect(isAutoApproved('destructive')).toBe(false);
  });

  it('respects empty autoApprove array', () => {
    patchConfig({ autoApprove: [] });
    expect(isAutoApproved('read')).toBe(false);
    expect(isAutoApproved('write')).toBe(false);
    expect(isAutoApproved('destructive')).toBe(false);
  });
});

describe('tierLabel', () => {
  it('returns the risk tier or "read"', () => {
    expect(tierLabel('write')).toBe('write');
    expect(tierLabel('destructive')).toBe('destructive');
    expect(tierLabel(undefined)).toBe('read');
  });
});
