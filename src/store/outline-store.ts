/**
 * Host-side "never" tier DOM cache.
 * Stores raw DOM state for tool queries without sending it to the model.
 */

export class OutlineStore {
  private cache = new Map<string, any>();

  set(key: string, value: any): void {
    this.cache.set(key, value);
  }

  get(key: string): any {
    return this.cache.get(key);
  }

  has(key: string): boolean {
    return this.cache.has(key);
  }

  clear(): void {
    this.cache.clear();
  }
}

export const outlineStore = new OutlineStore();
