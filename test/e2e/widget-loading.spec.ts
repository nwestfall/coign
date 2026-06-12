
import { test, expect } from '@playwright/test';

const LOADING_HTML = './test/fixtures/loading-test.html';

test.describe('Widget Loading Overlay', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(LOADING_HTML);
    await page.waitForFunction(() => (window as any).loadingTestAPI);
  });

  test.afterEach(async ({ page }) => {
    await page.evaluate(() => (window as any).loadingTestAPI.destroyWidget());
  });

  test('shows overlay on downloadStart', async ({ page }) => {
    await page.evaluate(() => (window as any).loadingTestAPI.createWidget());

    await page.evaluate(() => (window as any).loadingTestAPI.emitDownloadStart());

    const overlay = page.locator('#coign-widget-host >> .coign-loading-overlay');
    await expect(overlay).toHaveClass(/coign-loading-overlay--visible/);
  });

  test('updates progress bar on downloadProgress', async ({ page }) => {
    await page.evaluate(() => (window as any).loadingTestAPI.createWidget());
    await page.evaluate(() => (window as any).loadingTestAPI.emitDownloadStart());

    await page.evaluate(() =>
      (window as any).loadingTestAPI.emitDownloadProgress('downloading', 0.42, 'Fetching param cache...', undefined, undefined)
    );

    const bar = page.locator('#coign-widget-host >> .coign-loading-bar');
    const width = await bar.evaluate((el: HTMLElement) => el.style.width);
    expect(width).toBe('42%');

    const text = await page.locator('#coign-widget-host >> .coign-loading-text').textContent();
    expect(text).toContain('Downloading');
    expect(text).toContain('42%');
  });

  test('hides overlay on downloadComplete', async ({ page }) => {
    await page.evaluate(() => (window as any).loadingTestAPI.createWidget());
    await page.evaluate(() => (window as any).loadingTestAPI.emitDownloadStart());

    await page.evaluate(() => (window as any).loadingTestAPI.emitDownloadComplete());

    const overlay = page.locator('#coign-widget-host >> .coign-loading-overlay');
    await expect(overlay).toHaveClass(/coign-loading-overlay--hidden/);
  });

  test('hides overlay on ready', async ({ page }) => {
    await page.evaluate(() => (window as any).loadingTestAPI.createWidget());
    await page.evaluate(() => (window as any).loadingTestAPI.emitDownloadStart());

    await page.evaluate(() => (window as any).loadingTestAPI.emitReady());

    const overlay = page.locator('#coign-widget-host >> .coign-loading-overlay');
    await expect(overlay).toHaveClass(/coign-loading-overlay--hidden/);
  });

  test('cancel button hides overlay', async ({ page }) => {
    await page.evaluate(() => (window as any).loadingTestAPI.createWidget());
    await page.evaluate(() => (window as any).loadingTestAPI.emitDownloadStart());

    await page.evaluate(() => {
      const btn = document.querySelector('#coign-widget-host')?.shadowRoot?.querySelector('.coign-loading-btn--cancel') as HTMLButtonElement | null;
      btn?.click();
    });

    const overlay = page.locator('#coign-widget-host >> .coign-loading-overlay');
    await expect(overlay).toHaveClass(/coign-loading-overlay--hidden/);
  });

  test('error state shows retry button and hides cancel', async ({ page }) => {
    await page.evaluate(() => (window as any).loadingTestAPI.createWidget());
    await page.evaluate(() => (window as any).loadingTestAPI.emitDownloadStart());

    await page.evaluate(() => (window as any).loadingTestAPI.emitDownloadError('Network timeout'));

    const overlay = page.locator('#coign-widget-host >> .coign-loading-overlay');
    await expect(overlay).toHaveClass(/coign-loading-overlay--visible/);

    const errorText = page.locator('#coign-widget-host >> .coign-loading-error');
    await expect(errorText).toBeVisible();
    await expect(errorText).toHaveText('Network timeout');

    const cancelBtn = page.locator('#coign-widget-host >> .coign-loading-btn--cancel');
    await expect(cancelBtn).toBeHidden();

    const retryBtn = page.locator('#coign-widget-host >> .coign-loading-btn--retry');
    await expect(retryBtn).toBeVisible();
  });
});
