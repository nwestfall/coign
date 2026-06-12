
import { test, expect } from '@playwright/test';

const TOOLS_HTML = './test/fixtures/tools-test.html';

test.describe('Built-in tools', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(TOOLS_HTML);
    await page.waitForFunction(() => (window as any).toolAPI);
  });

  test('searchPage finds matches', async ({ page }) => {
    const result = await page.evaluate(() => (window as any).toolAPI.searchPage({ query: 'Pricing' }));
    expect(result.totalMatches).toBeGreaterThan(0);
    expect(result.hits.length).toBeGreaterThan(0);
    expect(result.hits[0].snippet).toContain('Pricing');
  });

  test('searchPage returns no matches for missing term', async ({ page }) => {
    const result = await page.evaluate(() => (window as any).toolAPI.searchPage({ query: 'xyzzynope' }));
    expect(result.totalMatches).toBe(0);
    expect(result.hits).toHaveLength(0);
  });

  test('getPageOutline returns markdown string', async ({ page }) => {
    const result = await page.evaluate(() => (window as any).toolAPI.getPageOutline({}));
    expect(typeof result).toBe('string');
    expect(result).toContain('# Coign Tools Test Fixture');
  });

  test('getElement returns element details', async ({ page }) => {
    const result = await page.evaluate(() =>
      (window as any).toolAPI.getElement({ selector: '#pricing' })
    );
    expect(result.found).toBe(true);
    expect(result.text).toContain('Pricing');
    expect(result.selector).toBe('#pricing');
  });

  test('getElement returns notFound when missing', async ({ page }) => {
    const result = await page.evaluate(() =>
      (window as any).toolAPI.getElement({ selector: '#does-not-exist' })
    );
    expect(result.found).toBe(false);
    expect(result.text).toBe('');
  });
});
