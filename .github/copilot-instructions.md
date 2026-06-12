# Coign SDK — Copilot Instructions

## Build, Test, and Lint

| Command | What it does |
|---------|-------------|
| `npm run build` | Type-check (`tsc --noEmit`) → Vite library build (ESM + CJS + IIFE) → generate SRI hashes (`scripts/generate-sri.js`) |
| `npm run build:types` | Emit `.d.ts` declarations only |
| `npm run dev` | Vite dev server; opens `/demo/phase1.html` by default |
| `npm run preview` | Preview the production build |
| `npm run test` | Run unit tests (Vitest) **and** e2e browser tests (Playwright) |
| `npm run test:unit` | Run Vitest unit tests only (`test/unit/`) |
| `npm run test:e2e` | Run Playwright browser tests only (`test/e2e/`) |
| `npm run test:watch` | Run Vitest in watch mode |
| `npm run lint` | Type-check only (`tsc --noEmit`) — there is no separate linter |

**Running a single test:**
- Unit: `npx vitest run test/unit/events.test.ts`
- E2E: `npx playwright test test/e2e/widget.spec.ts`

> The e2e tests require the IIFE bundle to be built (`npm run build`) because `test/fixtures/iife-test.html` loads `dist/coign-sdk.iife.js`. Playwright starts its own Vite dev server on port 5173 for the fixture files.

## High-Level Architecture

The Coign SDK is a **client-side-only AI agent** that runs entirely in the browser via WebGPU using `@mlc-ai/web-llm`. There are no cloud APIs, no servers, and no fallbacks.

### Entry Points
- **`src/index.ts`** — Primary entry point. Exports named functions (`init`, `ask`, `tool`, `destroy`, etc.) **and** a default `realAPI` object used by the IIFE bundle.
- **`src/queue-loader.ts`** — IIFE stub/replay pattern. Before the SDK loads, `window.Coign` queues calls in `window.Coign.q`. After load, the real API replays them.

### Core Layers
1. **Engine** (`src/core/engine.ts`) — Wraps `webllm.CreateMLCEngine`. Handles model loading with progress callbacks, chat completion requests, and engine destruction. All inference is 100 % offline after the first download.
2. **Presets** (`src/core/presets.ts`) — Maps friendly names (e.g. `coign-balanced`) to WebLLM `modelId`s. Includes metadata about model size and tool-calling support (`native`, `manual`, `unverified`).
3. **Context** (`src/core/context.ts`) — Extracts a `PageOutline` from the DOM at runtime: headings, landmarks, forms, JSON-LD, OpenGraph, links. This becomes part of the system prompt.

### LLM Tool-Calling
- **`src/llm/manual-tool-loop.ts`** — The **current** tool-calling path. Injects tool schemas into the system prompt as XML, parses `<function_calls>` blocks from the model output, executes tools, and feeds `<function_results>` back. Supports up to 5 turns.
- **`src/llm/native-tool-loop.ts`** — Stub for OpenAI-style native `tools` parameter. Deferred; throws `Error` if called.

### Tools
- **Registry** (`src/tools/registry.ts`) — `Map`-backed registry with namespace enforcement.
  - Built-in tools are prefixed `agent.*`.
  - Host tools are prefixed with the origin hostname (e.g. `example_com.*`), set at runtime by `setHostNamespace(location.origin)`.
- **Executor** (`src/tools/executor.ts`) — Wraps tool execution with a configurable timeout (`toolTimeoutMs`, default 5000 ms) and serializes results to JSON strings.
- **Risk Tiers** (`src/tools/risk-tiers.ts`) — `read` (auto-execute), `write` (confirmation dialog), `destructive` (typed confirmation required). Configurable via `autoApprove` array.
- **Built-in tools** (`src/tools/built-in/`):
  - `searchPage` — BM25 full-text search via `minisearch` across visible page content.
  - `getPageOutline` — Returns Markdown summary of the current page context.
  - `getElement` — Reads a single DOM element by CSS selector (text, HTML, attributes, viewport status).

### UI
- **`src/ui/widget.ts`** — Shadow DOM chat widget. Creates a floating bubble + panel, supports inline mounting, theming via CSS custom properties, focus trapping, and mobile bottom-sheet mode.
- **`src/ui/modal.ts`** — Native `<dialog>` element for write/destructive tool confirmations. Self-contained (injects its own styles).
- **`src/ui/styles.css`** — Styles imported with `?inline` so Vite bundles them as a string for Shadow DOM injection.

### Persistence & Events
- **Events** (`src/events.ts`) — Typed pub/sub bus (`on` / `emit`). Events: `load`, `ready`, `error`, `ask`, `answer`, `warn`, `toolCall`, `toolResult`, `unregister`.
- **History** (`src/store/history.ts`) — Saves conversation entries to `localStorage` keyed by origin. Capped at 50 messages / 100 KB.
- **Outline Store** (`src/store/outline-store.ts`) — In-memory cache for the current page outline (never persisted to backend).

## Testing

### Unit Tests (`test/unit/`)
Run in Vitest with `jsdom` environment. Cover pure/isomorphic logic:
- `presets.test.ts` — preset resolution and metadata
- `config.test.ts` — config defaults, patching, resetting
- `events.test.ts` — typed pub/sub event bus
- `queue-loader.test.ts` — IIFE stub/replay pattern
- `tools-registry.test.ts` — tool registration, validation, namespacing
- `risk-tiers.test.ts` — risk tier auto-approval logic
- `outline-store.test.ts` — in-memory outline cache

### E2E Tests (`test/e2e/`)
Run in Playwright + Chromium against real HTML fixtures (`test/fixtures/`):
- `iife-queue.spec.ts` — IIFE bundle loads and preserves queue
- `widget.spec.ts` — widget creation, show/hide, panel open/close, inline mount, theming, messages
- `tools.spec.ts` — built-in tools (`searchPage`, `getPageOutline`, `getElement`) on a known DOM
- `modal.spec.ts` — confirmation dialog for write risk tier

### Build Pipeline
- **Vite** in library mode produces three formats: `es`, `cjs`, `iife`.
- A custom Rollup plugin (`iifeFixPlugin` in `vite.config.ts`) appends `window.Coign = window.Coign.default || window.Coign;` to the IIFE bundle so the global variable is the callable API function, not a module namespace.
- `scripts/generate-sri.js` generates SHA-384 hashes for the three built bundles and writes them to `dist/sri.json`.
- `__VERSION__` is injected at build time from `package.json`.

## Key Conventions

### Import Paths
- All TypeScript imports use `.js` extensions (e.g. `import { x } from './types.js'`). This is required because the project is `"type": "module"` and targets ESM Node resolution.
- Path alias `@/` maps to `src/` (configured in both `tsconfig.json` and `vite.config.ts`).

### TypeScript Strictness
- `strict: true` with additional flags: `noUnusedLocals`, `noUnusedParameters`, `noImplicitReturns`, `noFallthroughCasesInSwitch`.
- `moduleResolution: "bundler"`.

### Browser-Only Code
- Use `typeof window !== 'undefined'` guards for any DOM or `window` access. The code may be imported in non-browser contexts (e.g. test runners, SSR).
- `navigator.gpu` checks are used to detect WebGPU support.

### Tool Registration
- Host tool names must match `/^[a-zA-Z][a-zA-Z0-9_]*$/`, max 64 chars.
- Descriptions are required and capped at 500 chars.
- Parameters must be a valid JSON Schema object.
- The `execute` property must be a function.

### IIFE / CDN Behavior
- The IIFE bundle is designed to be loaded from a CDN. The global `Coign` function supports two usage patterns:
  1. Command calls: `Coign('init', config)`
  2. Callback registration: `Coign(fn)` — fires when the SDK is ready
- The build always bundles **all** dependencies for the IIFE format. No external globals.

### Model Presets
| Preset | Model ID | Tool support |
|--------|----------|--------------|
| `coign-tiny` | `Qwen2-0.5B-Instruct-q4f16_1-MLC` | unverified |
| `coign-lite` | `Llama-3.2-1B-Instruct-q4f16_1-MLC` | unverified |
| `coign-balanced` | `Llama-3.2-3B-Instruct-q4f16_1-MLC` | manual (XML) |
| `coign-quality` | `Llama-3.1-8B-Instruct-q4f16_1-MLC` | manual (XML) |
| `coign-tools` | `Hermes-2-Pro-Llama-3-8B-q4f16_1-MLC` | native (stubbed) |

Use `resolvePreset(config.model)` to map a preset name to its WebLLM `modelId` before passing to the engine.
