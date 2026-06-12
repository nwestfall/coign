/**
 * WebLLM engine wrapper.
 * Handles model loading, chat completion requests, and progress reporting.
 */

import * as webllm from '@mlc-ai/web-llm';
import { emit } from '../events.js';
import type { CoignConfig, CoignError } from '../types.js';

let engine: webllm.MLCEngine | null = null;
let isLoading = false;
let loadedModelId: string | null = null;

export async function initEngine(config: CoignConfig): Promise<void> {
  if (engine && loadedModelId === config.model) {
    return;
  }
  if (isLoading) {
    throw makeError('config', 'Model is already loading');
  }
  isLoading = true;

  try {
    engine = await webllm.CreateMLCEngine(config.model, {
      initProgressCallback: (report) => {
        emit('load', { progress: report.progress, text: report.text });
      },
    });
    loadedModelId = config.model;
    emit('ready', {});
  } catch (err) {
    throw makeError('init', err instanceof Error ? err.message : String(err));
  } finally {
    isLoading = false;
  }
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

function makeError(kind: CoignError['kind'], message: string): CoignError {
  const e = new Error(message) as CoignError;
  e.kind = kind;
  return e;
}
