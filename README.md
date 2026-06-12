# Coign SDK

> A private, page-aware AI agent SDK that runs entirely in the visitor's browser.

No API keys. No servers. No per-message cost. The model downloads once (≈ 400 MB–4.5 GB depending on preset), caches locally in IndexedDB, and then answers questions, reads your page, searches content, and even executes custom tools — all on the user's device via WebGPU.  All inference is 100 % offline after the first download.

## Quick start

Paste two lines of HTML into any page:

```html
<script>
  window.Coign = window.Coign || function() {
    (window.Coign.q = window.Coign.q || []).push(arguments);
  };
  Coign('init', { preset: 'coign-balanced', prompt: 'You are a helpful assistant on this page.' });
</script>
<script src="https://cdn.coign.dev/coign-sdk@0.1.0.js" integrity="sha384-dios2vnX25M427yxLaLjQAMVU+n/4FE71rJYicVTE26FLQTDRoqY02tsC2iVZvSh" crossorigin="anonymous"></script>
```

The `window.Coign` stub queues calls before the SDK loads. Once loaded, the real API replays the queue automatically.

Or check browser support first:

```js
const check = await Coign.checkSupport();
if (!check.supported) {
  console.warn('Coign requires WebGPU. Reason:', check.reason);
} else {
  await Coign.init({ preset: 'coign-balanced' });
}
```

## Installation

### CDN (IIFE — easiest)

```html
<script src="https://cdn.coign.dev/coign-sdk@0.1.0.js" crossorigin="anonymous"></script>
```

### npm

```bash
npm install coign-sdk
```

```js
import { init, ask } from 'coign-sdk';
await init({ model: 'coign-balanced', prompt: '...' });
const answer = await ask('What is this page about?');
```

## Model presets

| Preset | Size | Tool support | Best for |
|--------|------|--------------|----------|
| `coign-tiny` | ~400 MB | unverified | Sub-second latency, low-power devices |
| `coign-lite` | ~1 GB | unverified | Documentation, FAQ pages |
| `coign-balanced` | ~1.8 GB | manual (XML) | The default |
| `coign-quality` | ~4.5 GB | manual (XML) | Long-form reasoning |
| `coign-tools` | ~4.5 GB | native (Hermes) | When tool-call reliability matters most |

Use `modelUrl` to load from a custom URL or your own CDN.  Use `cacheBackend` to control where weights are stored:

| Backend | Persistence | Use case |
|---------|-------------|----------|
| `indexeddb` (default) | Survives browser restarts | Standard offline usage |
| `opfs` | Survives browser restarts, faster on Chromium | Best performance / privacy |
| `cache` | May be evicted by browser | Development / low disk space |
| `cross-origin` | Service-worker based | Advanced / self-hosted mirrors |

### Download progress

Model downloads are large (400 MB–4.5 GB). You can track progress with callbacks or events:

```js
await Coign.init({
  preset: 'coign-balanced',
  onDownloadProgress: (p) => {
    console.log(p.stage, Math.round(p.progress * 100) + '%');
  },
  onDownloadComplete: () => console.log('Model ready'),
  onDownloadError: (err) => console.error('Download failed:', err),
});
```

The built-in widget also shows a progress overlay automatically. Cancel a slow download:

```js
Coign.cancelEngineInit(); // or click Cancel in the widget overlay
```

## Offline mode

Coign uses **WebLLM** (`@mlc-ai/web-llm`) exclusively.  There is **no** fallback to:
- Chrome AI / Prompt API / `chrome.ai`
- Gemini Nano or any built-in browser LLM
- OpenAI, Claude, or any cloud API

On first visit the chosen model downloads from HuggingFace/MLC (or your `modelUrl`) and is cached locally.  Every subsequent visit loads from cache and runs inference entirely in-browser via WebGPU — no network calls during chat.

## Built-in tools

The SDK ships with three built-in tools that give the agent awareness of the page:

- **`agent.searchPage`** — Full-text search across visible content (BM25, headings, links, alt text)
- **`agent.getPageOutline`** — Returns a structured outline: headings, landmarks, forms, JSON-LD, OpenGraph
- **`agent.getElement`** — Reads a specific DOM element's text, HTML, attributes, and viewport status

## Custom tools

Register host-side tools with full namespacing and risk tiers:

```js
Coign.tool({
  name: 'addToCart',
  description: 'Add an item to the shopping cart.',
  parameters: { type: 'object', properties: { item: { type: 'string' } } },
  risk: 'write',
  execute: async ({ item }) => {
    cart.add(item);
    return { success: true };
  },
});
```

Risk tiers:
- `read` — auto-executed (default)
- `write` — shows a confirmation dialog
- `destructive` — requires typed confirmation

Use `autoApprove: ['read', 'write']` to override per-tool or globally.

## API

### `init(config)` → `Promise<CoignSDK>`

Initializes the engine, registers built-in tools, and mounts the widget.

```js
await Coign.init({
  preset: 'coign-balanced',
  onDownloadProgress: (p) => console.log(p.stage, p.progress),
  onDownloadComplete: () => console.log('Model ready'),
  onDownloadError: (err) => console.error(err),
});
```

### `checkSupport()` → `Promise<SupportCheck>`

Verify WebGPU availability and estimate VRAM before calling `init()`.

```js
const check = await Coign.checkSupport();
// { supported: true, webgpu: true, browser: 'Chrome', estimatedVramMb: 4096 }
```

### `isInitialized()` / `isReady()`

Check SDK state at any time.

```js
Coign.isInitialized(); // true after init() resolves
Coign.isReady();       // true when the model is loaded and the engine is ready
```

### `retryInit(options)` → `Promise<CoignSDK>`

Re-attempt `init()` with exponential backoff.

```js
await Coign.retryInit({ preset: 'coign-balanced', maxRetries: 3, retryDelayMs: 2000 });
```

### `swapModel(model)` → `Promise<void>`

Switch models without destroying history or tools.

```js
await Coign.swapModel('coign-code');
```

### `ask(question)` → `Promise<string>`

Sends a question to the agent. Runs the tool-call loop automatically. Returns the final answer.

### `config(patch)`

Updates configuration at runtime (theme, position, prompt, etc.).

### `mount(selector)` / `unmount()`

Moves the widget inline into a host element, or back to floating mode.

### `show()` / `hide()`

Toggle the launcher bubble.

### `open()` / `close()`

Open or close the chat panel.

### `tool(def)` → `() => void`

Register a custom host tool. Returns an unregister function.

### `on(event, callback)` → `() => void`

Subscribe to SDK events: `load`, `ready`, `error`, `ask`, `answer`, `warn`, `toolCall`, `toolResult`, `unregister`, `downloadStart`, `downloadProgress`, `downloadComplete`, `downloadError`.

### `clearHistory()` / `exportHistory()`

Manage localStorage-persisted conversation history (capped at 50 messages / 100 KB).

### `destroy()`

Tear down the engine, widget, and all listeners.

## Examples & Demo

Visit the **published site** for live examples, interactive demos, and full documentation:

🔗 **https://nwestfall.github.io/coign/**

- [Landing page](https://nwestfall.github.io/coign/) — Overview, features, and quick start
- [Documentation](https://nwestfall.github.io/coign/docs.html) — API reference, architecture, model presets, custom tools, theming, risk tiers
- [Interactive Demo](https://nwestfall.github.io/coign/demo.html) — Browser check, model swap, built-in tools, widget controls, confirmation dialogs

You can also run the site locally:

```bash
npm run build       # build the SDK bundle first
npm run build:site  # build the site
npm run preview:site # preview locally
```

## Development

```bash
npm install
npm run dev         # Vite dev server
npm run build       # produces ESM, CJS, and IIFE bundles in dist/
npm run test        # runs unit tests + e2e tests
npm run test:unit   # Vitest unit tests (jsdom)
npm run test:e2e    # Playwright browser tests
npm run build:site  # build the GitHub Pages site
```

## Browser requirements

- **Chrome 113+**, **Edge 113+**, or **ChromeOS** (WebGPU required)
- ~4.5 GB free disk space for the largest model
- A one-time download on first visit (cached afterward)

Use `Coign.checkSupport()` to detect WebGPU and estimate VRAM before calling `init()`. If the browser is unsupported, `init()` throws a clear `CoignError` with `kind: 'browser_unsupported'`.

## Architecture

- **Inference:** [@mlc-ai/web-llm](https://github.com/mlc-ai/web-llm) via WebGPU
- **Search:** [MiniSearch](https://github.com/lucaong/minisearch) (BM25, prefix, fuzzy)
- **Build:** Vite (library mode for ESM + CJS + IIFE)
- **UI:** Vanilla JS, Shadow DOM, native `<dialog>`
- **Size:** ~25 KB gzipped (SDK + styles; models are separate)

## Documentation

- [SPEC.md](SPEC.md) — full product specification
- [tool-catalog.md](tool-catalog.md) — tool schemas and TypeScript types
- [model-presets.md](model-presets.md) — supported model presets

## Status

| Phase | Status |
|-------|--------|
| 1 — Vertical slice | ✅ Demo + smoke-test |
| 2 — Real SDK shape | ✅ Widget, loader, persistence, CDN bundle |
| 3 — Multi-runtime + WebMCP | 🔒 Deferred |
| 4 — Server-side companion | 🔒 Out of scope |

## License

MIT
