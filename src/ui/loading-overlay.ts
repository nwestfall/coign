/**
 * Loading overlay for the Coign widget.
 *
 * Shows progress bar, stage text, and cancel/retry controls during
 * model download and init. Auto-shows on downloadStart, auto-hides
 * on downloadComplete or downloadError.
 */

import type { DownloadProgress, CoignError } from '../types.js';
import { on } from '../events.js';
import { cancelEngineInit } from '../core/engine.js';

/* ------------------------------------------------------------------ */
/*  Module state                                                      */
/* ------------------------------------------------------------------ */

let overlayEl: HTMLElement | null = null;
let progressBarEl: HTMLElement | null = null;
let stageTextEl: HTMLElement | null = null;
let cancelBtnEl: HTMLButtonElement | null = null;
let retryBtnEl: HTMLButtonElement | null = null;
let errorTextEl: HTMLElement | null = null;
let unsubs: Array<() => void> = [];
let retryCallback: (() => void) | null = null;

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function createEl(tag: string, cls?: string, attrs?: Record<string, string>): HTMLElement {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  }
  return el;
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
  if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  return Math.round(bytes / 1024) + ' KB';
}

/* ------------------------------------------------------------------ */
/*  Build / attach overlay                                            */
/* ------------------------------------------------------------------ */

export interface LoadingOverlayCallbacks {
  onCancel?: () => void;
  onRetry?: () => void;
}

export function attachLoadingOverlay(
  container: HTMLElement,
  callbacks?: LoadingOverlayCallbacks
): void {
  if (overlayEl) return; // already attached
  retryCallback = callbacks?.onRetry ?? null;

  overlayEl = createEl('div', 'coign-loading-overlay');
  overlayEl.setAttribute('role', 'status');
  overlayEl.setAttribute('aria-live', 'polite');

  // Progress bar track
  const track = createEl('div', 'coign-loading-track');
  progressBarEl = createEl('div', 'coign-loading-bar');
  track.appendChild(progressBarEl);
  overlayEl.appendChild(track);

  // Stage text
  stageTextEl = createEl('div', 'coign-loading-text');
  stageTextEl.textContent = 'Checking cache…';
  overlayEl.appendChild(stageTextEl);

  // Error text (hidden by default)
  errorTextEl = createEl('div', 'coign-loading-error');
  errorTextEl.style.display = 'none';
  overlayEl.appendChild(errorTextEl);

  // Buttons
  const btnRow = createEl('div', 'coign-loading-buttons');

  cancelBtnEl = document.createElement('button');
  cancelBtnEl.className = 'coign-loading-btn coign-loading-btn--cancel';
  cancelBtnEl.textContent = 'Cancel';
  cancelBtnEl.addEventListener('click', onCancel);
  btnRow.appendChild(cancelBtnEl);

  retryBtnEl = document.createElement('button');
  retryBtnEl.className = 'coign-loading-btn coign-loading-btn--retry';
  retryBtnEl.textContent = 'Retry';
  retryBtnEl.style.display = 'none';
  retryBtnEl.addEventListener('click', onRetry);
  btnRow.appendChild(retryBtnEl);

  overlayEl.appendChild(btnRow);

  container.appendChild(overlayEl);

  // Wire events
  unsubs.push(
    on('downloadStart', () => show()),
    on('downloadProgress', ({ stage, progress, text, loadedBytes, totalBytes }) => {
      updateProgress(stage, progress, text, loadedBytes, totalBytes);
    }),
    on('downloadComplete', () => hide()),
    on('downloadError', (err) => showError(err)),
    on('ready', () => hide())
  );
}

export function detachLoadingOverlay(): void {
  unsubs.forEach((u) => u());
  unsubs = [];
  if (overlayEl) {
    overlayEl.remove();
    overlayEl = null;
  }
  progressBarEl = null;
  stageTextEl = null;
  cancelBtnEl = null;
  retryBtnEl = null;
  errorTextEl = null;
}

/* ------------------------------------------------------------------ */
/*  Visibility                                                        */
/* ------------------------------------------------------------------ */

function show(): void {
  if (!overlayEl) return;
  overlayEl.classList.remove('coign-loading-overlay--hidden');
  overlayEl.classList.add('coign-loading-overlay--visible');
  // Reset error state
  if (errorTextEl) errorTextEl.style.display = 'none';
  if (cancelBtnEl) cancelBtnEl.style.display = 'inline-block';
  if (retryBtnEl) retryBtnEl.style.display = 'none';
  if (progressBarEl) progressBarEl.style.width = '0%';
}

function hide(): void {
  if (!overlayEl) return;
  overlayEl.classList.remove('coign-loading-overlay--visible');
  overlayEl.classList.add('coign-loading-overlay--hidden');
}

/* ------------------------------------------------------------------ */
/*  Progress update                                                     */
/* ------------------------------------------------------------------ */

function updateProgress(
  stage: DownloadProgress['stage'],
  progress: number,
  text: string,
  loadedBytes?: number,
  totalBytes?: number
): void {
  if (!overlayEl) return;
  if (!overlayEl.classList.contains('coign-loading-overlay--visible')) {
    show();
  }

  if (progressBarEl) {
    const pct = Math.max(0, Math.min(100, Math.round(progress * 100)));
    progressBarEl.style.width = `${pct}%`;
  }

  if (stageTextEl) {
    let label = text;
    if (stage === 'checking-cache') label = 'Checking local cache…';
    else if (stage === 'downloading') label = 'Downloading model weights…';
    else if (stage === 'compiling') label = 'Compiling shaders…';
    else if (stage === 'ready') label = 'Ready!';

    if (loadedBytes !== undefined && totalBytes !== undefined && totalBytes > 0) {
      label += ` (${formatBytes(loadedBytes)} / ${formatBytes(totalBytes)})`;
    } else if (progress > 0 && progress < 1) {
      label += ` (${Math.round(progress * 100)}%)`;
    }

    stageTextEl.textContent = label;
  }
}

/* ------------------------------------------------------------------ */
/*  Error state                                                       */
/* ------------------------------------------------------------------ */

function showError(err: CoignError): void {
  if (!overlayEl) return;
  show();
  if (progressBarEl) progressBarEl.style.width = '100%';
  if (stageTextEl) stageTextEl.textContent = 'Failed to load model';
  if (errorTextEl) {
    errorTextEl.textContent = err.message || 'An unknown error occurred.';
    errorTextEl.style.display = 'block';
  }
  if (cancelBtnEl) cancelBtnEl.style.display = 'none';
  if (retryBtnEl) retryBtnEl.style.display = 'inline-block';
}

/* ------------------------------------------------------------------ */
/*  Button handlers                                                   */
/* ------------------------------------------------------------------ */

function onCancel(): void {
  cancelEngineInit();
  hide();
  // We intentionally do NOT call destroy() here — the user may want to
  // keep the widget shell and retry later.
}

function onRetry(): void {
  if (retryCallback) {
    retryCallback();
  }
}
