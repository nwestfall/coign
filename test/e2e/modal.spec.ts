
import { test, expect } from '@playwright/test';

const TOOLS_HTML = './test/fixtures/tools-test.html';

test.describe('Confirm dialog', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(TOOLS_HTML);
    await page.waitForFunction(() => (window as any).toolAPI);
  });

  test('shows dialog with title and body', async ({ page }) => {
    const promise = page.evaluate(() =>
      (window as any).toolAPI.showConfirmDialog('Delete this item?', 'write')
    );

    const dialog = page.locator('dialog.coign-modal');
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('.coign-modal-title')).toHaveText('Confirm Action');
    await expect(dialog.locator('.coign-modal-message')).toHaveText('Delete this item?');
    await expect(dialog.locator('.coign-modal-btn--allow')).toHaveText('Allow');
    await expect(dialog.locator('.coign-modal-btn--deny')).toHaveText('Deny');

    // Dismiss dialog so promise resolves
    await page.locator('dialog.coign-modal .coign-modal-btn--deny').click();
    await promise;
  });

  test('confirm resolves true', async ({ page }) => {
    const promise = page.evaluate(() =>
      (window as any).toolAPI.showConfirmDialog('Proceed?', 'write')
    );

    await page.locator('dialog.coign-modal .coign-modal-btn--allow').click();
    const result = await promise;
    expect(result).toBe(true);
  });

  test('cancel resolves false', async ({ page }) => {
    const promise = page.evaluate(() =>
      (window as any).toolAPI.showConfirmDialog('Proceed?', 'write')
    );

    await page.locator('dialog.coign-modal .coign-modal-btn--deny').click();
    const result = await promise;
    expect(result).toBe(false);
  });
});
