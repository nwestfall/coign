import { describe, it, expect, beforeEach } from 'vitest';
import { outlineStore, OutlineStore } from '../../src/store/outline-store.js';

describe('OutlineStore', () => {
  let store: OutlineStore;

  beforeEach(() => {
    store = new OutlineStore();
  });

  it('stores and retrieves values', () => {
    const outline = { title: 'Test', url: 'http://example.com' };
    store.set('current', outline);
    expect(store.get('current')).toEqual(outline);
  });

  it('returns undefined for missing keys', () => {
    expect(store.get('missing')).toBeUndefined();
  });

  it('reports key existence', () => {
    store.set('a', 1);
    expect(store.has('a')).toBe(true);
    expect(store.has('b')).toBe(false);
  });

  it('clears all entries', () => {
    store.set('a', 1);
    store.set('b', 2);
    store.clear();
    expect(store.has('a')).toBe(false);
    expect(store.has('b')).toBe(false);
  });

  it('overwrites existing keys', () => {
    store.set('key', 'first');
    store.set('key', 'second');
    expect(store.get('key')).toBe('second');
  });
});

describe('outlineStore singleton', () => {
  it('is shared across imports', () => {
    outlineStore.set('shared', 'value');
    // Re-import would get the same instance in real code;
    // here we just verify the singleton behaves like a store
    expect(outlineStore.has('shared')).toBe(true);
    outlineStore.clear();
  });
});
