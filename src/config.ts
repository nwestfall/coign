/**
 * Global configuration defaults and runtime config management.
 */

import type { CoignConfig } from './types.js';

export const DEFAULT_CONFIG: Partial<CoignConfig> = {
  selectDOM: 'main, [role="main"], article',
  preloadMode: 'outline',
  position: 'bottom-right',
  theme: {},
  autoApprove: ['read'],
  persistHistory: true,
  cacheBackend: 'cache',
  toolTimeoutMs: 5000,
} as const;

let _globalConfig: Partial<CoignConfig> = {};

export function getConfig(): Readonly<Partial<CoignConfig>> {
  return Object.freeze({ ...DEFAULT_CONFIG, ..._globalConfig });
}

export function patchConfig(patch: Partial<CoignConfig>): void {
  _globalConfig = { ..._globalConfig, ...patch };
}

export function resetConfig(): void {
  _globalConfig = {};
}
