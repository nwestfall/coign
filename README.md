# Coign SDK

> A private, page-aware AI agent SDK that runs entirely in the visitor's browser.

No API keys. No servers. No per-message cost. The model downloads once (≈ 400 MB–4.5 GB depending on preset), caches locally in IndexedDB, and then answers questions, reads your page, searches content, and even executes custom tools — all on the user's device via WebGPU.  All inference is 100 % offline after the first download.

## Quick start

Paste two lines of HTML into any page:

```html
<script src="https://cdn.coign.dev/coign-sdk@0.1.0.js" integrity="sha384-dios2vnX25M427yxLaLjQAMVU+n/4FE71rJYicVTE26FLQTDRoqY02tsC2iVZvSh" crossorigin="anonymous"></script>
<script>
  Coign.init({
    model: 'coign-balanced',
    prompt: 'You are a helpful assistant on this page.',
  });
</script>
```

Or use the queue pattern so calls work even before the script loads:

```html
<script>
  window.Coign = window.Coign || function() {
    (window.Coign.q = window.Coign.q || []).push(arguments);
  };
  Coign('init', { model: 'coign-balanced', prompt: 'You are a helpful assistant.' });
  Coign('config', { theme: { accent: '#6366f1' } });
</script>
<script src="https://cdn.coign.dev/coign-sdk@0.1.0.js" crossorigin="anonymous"></script>
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

Subscribe to SDK events: `load`, `ready`, `error`, `ask`, `answer`, `warn`, `toolCall`, `toolResult`, `unregister`.

### `clearHistory()` / `exportHistory()`

Manage localStorage-persisted conversation history (capped at 50 messages / 100 KB).

### `destroy()`

Tear down the engine, widget, and all listeners.

## Examples

See the [`examples/`](examples/) directory:

- [`plain-html`](examples/plain-html/) — simplest integration
- [`cms-embed`](examples/cms-embed/) — inline mount inside a CMS preview
- [`custom-tools`](examples/custom-tools/) — register a shopping-cart tool
- [`inline-mode`](examples/inline-mode/) — sidebar chat panel

## Development

```bash
npm install
npm run dev        # opens the Phase 1 demo
npm run build      # produces ESM, CJS, and IIFE bundles in dist/
npm run test       # runs the smoke-test harness (requires WebGPU)
```

## Browser requirements

- **Chrome 113+**, **Edge 113+**, or **ChromeOS** (WebGPU required)
- ~4.5 GB free disk space for the largest model
- A one-time download on first visit (cached afterward)

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
