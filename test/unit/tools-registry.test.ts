import { describe, it, expect, beforeEach } from 'vitest';
import {
  registerBuiltin,
  registerHost,
  lookupTool,
  listTools,
  isKnownTool,
  setHostNamespace,
  ToolRegistrationError,
} from '../../src/tools/registry.js';

describe('registerBuiltin', () => {
  beforeEach(() => {
    // Reset internal state by re-registering nothing
    // Note: there is no public reset, so we test idempotency
  });

  it('registers built-in tools under agent namespace', () => {
    const def = {
      name: 'test',
      description: 'A test tool',
      parameters: { type: 'object' },
      execute: () => {},
    };
    registerBuiltin('test', def);
    expect(isKnownTool('agent.test')).toBe(true);
    expect(lookupTool('agent.test')).toBe(def);
  });
});

describe('registerHost', () => {
  beforeEach(() => {
    setHostNamespace('https://example.com');
  });

  it('registers host tools under origin namespace', () => {
    const def = {
      name: 'cart',
      description: 'Add to cart',
      parameters: { type: 'object' },
      execute: () => {},
    };
    registerHost(def);
    expect(isKnownTool('example_com.cart')).toBe(true);
    expect(lookupTool('example_com.cart')).toBe(def);
  });

  it('returns an unregister function', () => {
    const def = {
      name: 'temp',
      description: 'Temporary',
      parameters: { type: 'object' },
      execute: () => {},
    };
    const unregister = registerHost(def);
    expect(isKnownTool('example_com.temp')).toBe(true);
    unregister();
    expect(isKnownTool('example_com.temp')).toBe(false);
  });

  it('rejects invalid tool names', () => {
    const invalid = [
      { name: '', description: 'x', parameters: {}, execute: () => {} },
      { name: '123', description: 'x', parameters: {}, execute: () => {} },
      { name: 'a b', description: 'x', parameters: {}, execute: () => {} },
      { name: 'a'.repeat(65), description: 'x', parameters: {}, execute: () => {} },
    ];

    for (const def of invalid) {
      expect(() => registerHost(def as any)).toThrow(ToolRegistrationError);
    }
  });

  it('rejects tools without description', () => {
    expect(() =>
      registerHost({
        name: 'noDesc',
        description: '',
        parameters: { type: 'object' },
        execute: () => {},
      })
    ).toThrow(ToolRegistrationError);
  });

  it('rejects tools with oversized descriptions', () => {
    expect(() =>
      registerHost({
        name: 'longDesc',
        description: 'x'.repeat(501),
        parameters: { type: 'object' },
        execute: () => {},
      })
    ).toThrow(ToolRegistrationError);
  });

  it('rejects tools without parameters', () => {
    expect(() =>
      registerHost({
        name: 'noParams',
        description: 'x',
        parameters: undefined as any,
        execute: () => {},
      })
    ).toThrow(ToolRegistrationError);
  });

  it('rejects tools without execute function', () => {
    expect(() =>
      registerHost({
        name: 'noExec',
        description: 'x',
        parameters: { type: 'object' },
        execute: 'not a function' as any,
      })
    ).toThrow(ToolRegistrationError);
  });
});

describe('setHostNamespace', () => {
  it('uses hostname with underscores', () => {
    setHostNamespace('https://my-site.example.com');
    const def = {
      name: 'x',
      description: 'x',
      parameters: { type: 'object' },
      execute: () => {},
    };
    registerHost(def);
    expect(isKnownTool('my-site_example_com.x')).toBe(true);
  });

  it('falls back to "page" on invalid origin', () => {
    setHostNamespace('not-a-url');
    const def = {
      name: 'x',
      description: 'x',
      parameters: { type: 'object' },
      execute: () => {},
    };
    registerHost(def);
    expect(isKnownTool('page.x')).toBe(true);
  });
});

describe('listTools', () => {
  it('returns all registered tools', () => {
    const items = listTools();
    expect(Array.isArray(items)).toBe(true);
    for (const item of items) {
      expect(item.fullName).toBeTruthy();
      expect(item.def).toBeTruthy();
    }
  });
});
