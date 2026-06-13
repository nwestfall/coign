/**
 * WebLLM engine wrapper.
 * Handles model loading, chat completion requests, and progress reporting.
 */

import * as webllm from '@mlc-ai/web-llm';
import { emit } from '../events.js';
import type { CoignConfig, CoignError, DownloadProgress } from '../types.js';

let engine: webllm.MLCEngine | null = null;
let isLoading = false;
let loadedModelId: string | null = null;
let cancelRequested = false;

export function getIsLoading(): boolean {
  return isLoading;
}

export async function initEngine(config: CoignConfig): Promise<void> {
  if (!config.model) {
    throw makeError('config', 'Model is required');
  }
  if (engine && loadedModelId === config.model) {
    return;
  }
  if (isLoading) {
    throw makeError('config', 'Model is already loading');
  }
  isLoading = true;
  cancelRequested = false;

  try {
    emit('downloadStart', {});

    // Build AppConfig from either a custom model URL or the built-in prebuilt registry
    const appConfig = buildAppConfig(config);

    engine = await webllm.CreateMLCEngine(config.model, {
      appConfig,
      initProgressCallback: (report) => {
        if (cancelRequested) return;
        const progress: DownloadProgress = {
          stage: mapStage(report.text),
          progress: report.progress,
          text: report.text,
        };
        emit('load', { progress: report.progress, text: report.text });
        emit('downloadProgress', progress);
        if (config.onDownloadProgress) {
          config.onDownloadProgress(progress);
        }
      },
    });

    if (cancelRequested) {
      engine?.unload();
      engine = null;
      loadedModelId = null;
      throw makeError('init', 'Model download was cancelled by the user.');
    }

    loadedModelId = config.model;
    emit('downloadComplete', {});
    emit('ready', {});
    if (config.onDownloadComplete) {
      try {
        config.onDownloadComplete();
      } catch (e) {
        console.error('[Coign] onDownloadComplete callback error:', e);
      }
    }
  } catch (err) {
    const coignErr =
      err instanceof Error && (err as CoignError).kind
        ? (err as CoignError)
        : makeError('init', err instanceof Error ? err.message : String(err));

    emit('downloadError', coignErr);
    emit('error', coignErr);
    if (config.onDownloadError) {
      try {
        config.onDownloadError(coignErr);
      } catch (e) {
        console.error('[Coign] onDownloadError callback error:', e);
      }
    }
    throw coignErr;
  } finally {
    isLoading = false;
  }
}

/**
 * Request cancellation of an in-progress engine init.
 * The next progress callback check will abort.
 */
export function cancelEngineInit(): void {
  cancelRequested = true;
}

/**
 * Map WebLLM progress text into a coarse stage enum.
 */
function mapStage(text: string): DownloadProgress['stage'] {
  const t = text.toLowerCase();
  if (t.includes('cache') || t.includes('check')) return 'checking-cache';
  if (t.includes('compile') || t.includes('build') || t.includes('wasm')) return 'compiling';
  if (t.includes('downloa') || t.includes('fetch') || t.includes('weight')) return 'downloading';
  if (t.includes('finish') || t.includes('done') || t.includes('ready')) return 'ready';
  return 'downloading';
}

export async function chatCompletion(
  messages: webllm.ChatCompletionMessageParam[],
  options?: Partial<webllm.ChatCompletionRequest>
): Promise<string> {
  if (!engine) {
    throw makeError('model', 'Engine not initialized. Call Coign.init() first.');
  }

  try {
    const reply = await engine.chat.completions.create({
      messages,
      stream: false,
      ...options,
    });
    const completion = reply as webllm.ChatCompletion;
    const choice = completion.choices[0];
    if (!choice) {
      throw makeError('model', 'No completion returned from model.');
    }
    return choice.message.content ?? '';
  } catch (err) {
    throw makeError('model', err instanceof Error ? err.message : String(err));
  }
}

export function getEngine(): webllm.MLCEngine | null {
  return engine;
}

export function destroyEngine(): void {
  engine?.unload();
  engine = null;
  loadedModelId = null;
}

/**
 * Build an explicit WebLLM AppConfig so the engine uses ONLY the
 * local WebLLM runtime — no Chrome AI APIs, no online inference
 * services, no fallback to cloud LLMs.
 *
 * WebLLM downloads model weights once (from HuggingFace/MLC or a
 * custom `modelUrl`) and caches them locally.  All subsequent
 * inference runs 100 % in-browser via WebGPU.
 *
 * Three paths:
 * 1. `config.modelUrl` is provided → single-entry custom model list
 *    (self-hosted / fully-offline mirror).
 * 2. `config.cacheBackend` is provided → override the default.
 * 3. Default → use `prebuiltAppConfig` with `indexeddb` cache for
 *    strong offline persistence across browser sessions.
 */
function buildAppConfig(config: CoignConfig): webllm.AppConfig {
  const cacheBackend = config.cacheBackend ?? 'indexeddb';

  if (config.modelUrl) {
    const base = config.modelUrl.replace(/\/$/, '');
    const modelRecord: webllm.ModelRecord = {
      model: base,
      model_id: config.model!,
      model_lib: base + '/' + config.model! + '-webgpu.wasm',
      vram_required_MB: 0,
      low_resource_required: true,
    };
    const appConfig: webllm.AppConfig = {
      model_list: [modelRecord],
      cacheBackend,
    };
    return appConfig;
  }

  const appConfig: webllm.AppConfig = {
    ...webllm.prebuiltAppConfig,
    cacheBackend,
  };
  return appConfig;
}

function makeError(kind: CoignError['kind'], message: string): CoignError {
  const e = new Error(message) as CoignError;
  e.kind = kind;
  return e;
}
