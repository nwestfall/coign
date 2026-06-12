
import { test, expect } from '@playwright/test';

const WIDGET_HTML = './test/fixtures/widget-test.html';

test.describe('Widget', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(WIDGET_HTML);
    await page.waitForFunction(() => (window as any).widgetAPI);
  });

  test.afterEach(async ({ page }) => {
    await page.evaluate(() => (window as any).widgetAPI.destroyWidget());
  });

  test('creates a shadow-root floating widget', async ({ page }) => {
    await page.evaluate(() => (window as any).widgetAPI.createWidget({}));

    const host = page.locator('#coign-widget-host');
    await expect(host).toBeAttached();

    const hasShadow = await host.evaluate((el) => (el as HTMLElement).shadowRoot instanceof ShadowRoot);
    expect(hasShadow).toBe(true);
  });

  test('show and hide toggle visibility', async ({ page }) => {
    await page.evaluate(() => (window as any).widgetAPI.createWidget({}));

    await page.evaluate(() => (window as any).widgetAPI.hideWidget());
    let hidden = await page.evaluate(() => {
      const host = document.querySelector('#coign-widget-host');
      return host?.classList.contains('coign-host--hidden');
    });
    expect(hidden).toBe(true);

    await page.evaluate(() => (window as any).widgetAPI.showWidget());
    hidden = await page.evaluate(() => {
      const host = document.querySelector('#coign-widget-host');
      return host?.classList.contains('coign-host--hidden');
    });
    expect(hidden).toBe(false);
  });

  test('open and close panel', async ({ page }) => {
    await page.evaluate(() => (window as any).widgetAPI.createWidget({}));

    await page.evaluate(() => (window as any).widgetAPI.openPanel());
    let open = await page.evaluate(() => {
      const panel = document.querySelector('#coign-widget-host')?.shadowRoot?.querySelector('.coign-panel');
      return panel?.classList.contains('coign-panel--open');
    });
    expect(open).toBe(true);

    await page.evaluate(() => (window as any).widgetAPI.closePanel());
    open = await page.evaluate(() => {
      const panel = document.querySelector('#coign-widget-host')?.shadowRoot?.querySelector('.coign-panel');
      return panel?.classList.contains('coign-panel--open');
    });
    expect(open).toBe(false);
  });

  test('inline mount moves widget into host', async ({ page }) => {
    await page.evaluate(() => (window as any).widgetAPI.createWidget({}));
    await page.evaluate(() => (window as any).widgetAPI.mountInline('#inline-host'));

    const widgetInHost = await page.evaluate(() => {
      const host = document.querySelector('#inline-host');
      return host?.contains(document.querySelector('#coign-widget-host')) ?? false;
    });
    expect(widgetInHost).toBe(true);

    await page.evaluate(() => (window as any).widgetAPI.unmountInline());
    const widgetInBody = await page.evaluate(() => {
      return document.body.contains(document.querySelector('#coign-widget-host'));
    });
    expect(widgetInBody).toBe(true);
  });

  test('add messages appends to chat log', async ({ page }) => {
    await page.evaluate(() => (window as any).widgetAPI.createWidget({}));
    await page.evaluate(() => (window as any).widgetAPI.openPanel());

    await page.evaluate(() => (window as any).widgetAPI.addUserMessage('Hello AI'));
    await page.evaluate(() => (window as any).widgetAPI.addAssistantMessage('Hi there!'));

    const messages = await page.evaluate(() => {
      const root = document.querySelector('#coign-widget-host')?.shadowRoot;
      return root?.querySelectorAll('.coign-message').length ?? 0;
    });
    expect(messages).toBe(2);
  });

  test('applyTheme updates CSS custom properties', async ({ page }) => {
    await page.evaluate(() => (window as any).widgetAPI.createWidget({}));
    await page.evaluate(() => (window as any).widgetAPI.applyTheme({ accent: '#ff00ff' }));

    const accent = await page.evaluate(() => {
      const root = document.querySelector('#coign-widget-host')?.shadowRoot;
      const widget = root?.querySelector('.coign-widget') as HTMLElement | null;
      return widget ? getComputedStyle(widget).getPropertyValue('--coign-accent').trim() : null;
    });
    expect(accent).toBe('#ff00ff');
  });
});
