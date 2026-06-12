
import { test, expect } from '@playwright/test';

const IIFE_HTML = './test/fixtures/iife-test.html';

test.describe('IIFE queue loader', () => {
  test('replaces stub with real API and preserves queue', async ({ page }) => {
    await page.goto(IIFE_HTML);

    // After load, Coign should be the real API (callable function with properties)
    const coignType = await page.evaluate(() => typeof (window as any).Coign);
    expect(coignType).toBe('function');

    // Queue should be preserved as an array
    const hasQueue = await page.evaluate(() => Array.isArray((window as any).Coign.q));
    expect(hasQueue).toBe(true);

    // Version should be available
    const version = await page.evaluate(() => (window as any).Coign.version);
    expect(typeof version).toBe('string');
    expect(version).toMatch(/^\d+\.\d+/);
  });

  test('exposes expected API methods', async ({ page }) => {
    await page.goto(IIFE_HTML);

    const api = await page.evaluate(() => {
      const c = (window as any).Coign;
      return {
        hasInit: typeof c.init === 'function',
        hasAsk: typeof c.ask === 'function',
        hasConfig: typeof c.config === 'function',
        hasShow: typeof c.show === 'function',
        hasHide: typeof c.hide === 'function',
        hasDestroy: typeof c.destroy === 'function',
      };
    });

    expect(api.hasInit).toBe(true);
    expect(api.hasAsk).toBe(true);
    expect(api.hasConfig).toBe(true);
    expect(api.hasShow).toBe(true);
    expect(api.hasHide).toBe(true);
    expect(api.hasDestroy).toBe(true);
  });
});
