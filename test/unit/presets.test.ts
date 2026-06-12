import { describe, it, expect } from 'vitest';
import { resolvePreset, getPresetSupport, PRESETS } from '../../src/core/presets.js';

describe('resolvePreset', () => {
  it('maps friendly preset names to WebLLM model IDs', () => {
    expect(resolvePreset('coign-balanced')).toBe('Llama-3.2-3B-Instruct-q4f16_1-MLC');
    expect(resolvePreset('coign-tiny')).toBe('Qwen2-0.5B-Instruct-q4f16_1-MLC');
    expect(resolvePreset('coign-quality')).toBe('Llama-3.1-8B-Instruct-q4f16_1-MLC');
    expect(resolvePreset('coign-tools')).toBe('Hermes-2-Pro-Llama-3-8B-q4f16_1-MLC');
  });

  it('returns raw model IDs unchanged', () => {
    const raw = 'Llama-3.2-3B-Instruct-q4f16_1-MLC';
    expect(resolvePreset(raw)).toBe(raw);
  });

  it('returns unknown strings unchanged', () => {
    expect(resolvePreset('unknown-preset')).toBe('unknown-preset');
  });
});

describe('getPresetSupport', () => {
  it('returns native for coign-tools', () => {
    expect(getPresetSupport('Hermes-2-Pro-Llama-3-8B-q4f16_1-MLC')).toBe('native');
  });

  it('returns manual for coign-balanced and coign-quality', () => {
    expect(getPresetSupport('Llama-3.2-3B-Instruct-q4f16_1-MLC')).toBe('manual');
    expect(getPresetSupport('Llama-3.1-8B-Instruct-q4f16_1-MLC')).toBe('manual');
  });

  it('returns manual for unknown models', () => {
    expect(getPresetSupport('Some-Unknown-Model')).toBe('manual');
  });
});

describe('PRESETS', () => {
  it('contains exactly 5 presets', () => {
    expect(Object.keys(PRESETS)).toHaveLength(5);
  });

  it('each preset has required fields', () => {
    for (const [key, preset] of Object.entries(PRESETS)) {
      expect(preset.name).toBe(key);
      expect(preset.modelId).toBeTruthy();
      expect(typeof preset.sizeMb).toBe('number');
      expect(preset.sizeMb).toBeGreaterThan(0);
      expect(['native', 'manual', 'unverified']).toContain(preset.toolSupport);
      expect(preset.recommended).toBeTruthy();
    }
  });
});
