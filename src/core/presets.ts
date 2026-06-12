/**
 * Model presets and capability table.
 */

export interface Preset {
  name: string;
  modelId: string;
  sizeMb: number;
  toolSupport: 'native' | 'manual' | 'unverified';
  recommended: string;
}

export const PRESETS: Record<string, Preset> = {
  'coign-tiny': {
    name: 'coign-tiny',
    modelId: 'Qwen2-0.5B-Instruct-q4f16_1-MLC',
    sizeMb: 400,
    toolSupport: 'unverified',
    recommended: 'Sub-second latency, low-power devices',
  },
  'coign-lite': {
    name: 'coign-lite',
    modelId: 'Llama-3.2-1B-Instruct-q4f16_1-MLC',
    sizeMb: 1000,
    toolSupport: 'unverified',
    recommended: 'Documentation, FAQ pages',
  },
  'coign-balanced': {
    name: 'coign-balanced',
    modelId: 'Llama-3.2-3B-Instruct-q4f16_1-MLC',
    sizeMb: 1800,
    toolSupport: 'manual',
    recommended: 'The default',
  },
  'coign-quality': {
    name: 'coign-quality',
    modelId: 'Llama-3.1-8B-Instruct-q4f16_1-MLC',
    sizeMb: 4500,
    toolSupport: 'manual',
    recommended: 'Long-form reasoning, complex questions',
  },
  'coign-tools': {
    name: 'coign-tools',
    modelId: 'Hermes-2-Pro-Llama-3-8B-q4f16_1-MLC',
    sizeMb: 4500,
    toolSupport: 'native',
    recommended: 'When tool-call reliability matters most',
  },
};

export function resolvePreset(input: string): string {
  const preset = PRESETS[input];
  return preset ? preset.modelId : input;
}

export function getPresetSupport(modelId: string): 'native' | 'manual' {
  for (const key in PRESETS) {
    if (PRESETS[key].modelId === modelId) {
      const support = PRESETS[key].toolSupport;
      return support === 'native' ? 'native' : 'manual';
    }
  }
  return 'manual'; // default fallback for unknown models
}
