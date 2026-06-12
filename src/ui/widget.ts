/**
 * Shadow DOM chat widget.
 * Phase 2 deliverable — bottom-right bubble, panel, inline mount,
 * mobile bottom-sheet, theming, and accessibility.
 */

import type { CoignConfig, CoignTheme } from '../types.js';
import styles from './styles.css?inline';
import { attachLoadingOverlay, detachLoadingOverlay } from './loading-overlay.js';
import { on } from '../events.js';

/* ------------------------------------------------------------------ */
/*  Module state                                                      */
/* ------------------------------------------------------------------ */

let hostElement: HTMLElement | null = null;
let shadowRoot: ShadowRoot | null = null;
let bubbleEl: HTMLButtonElement | null = null;
let panelEl: HTMLElement | null = null;
let messagesEl: HTMLElement | null = null;
let formEl: HTMLFormElement | null = null;
let inputEl: HTMLInputElement | null = null;
let onSubmitCallback: ((question: string) => void) | null = null;
let isPanelOpen = false;
let isInline = false;
let originalParent: HTMLElement | null = null;
let focusTrapCleanup: (() => void) | null = null;
let lastFocusedElement: Element | null = null;
let resizeHandler: (() => void) | null = null;
let keydownHandler: ((e: KeyboardEvent) => void) | null = null;
let isThinking = false;
let thinkingMsgEl: HTMLElement | null = null;

/* ------------------------------------------------------------------ */
/*  DOM helpers                                                       */
/* ------------------------------------------------------------------ */

function createEl(tag: string, cls?: string, attrs?: Record<string, string>): HTMLElement {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  }
  return el;
}

/* ------------------------------------------------------------------ */
/*  createWidget                                                      */
/* ------------------------------------------------------------------ */

export function createWidget(config: CoignConfig, onSubmit?: (question: string) => void): void {
  if (hostElement) return; // already initialised

  onSubmitCallback = onSubmit ?? null;

  hostElement = createEl('div', undefined, { id: 'coign-widget-host' });

  shadowRoot = hostElement.attachShadow({ mode: 'open' });

  const styleEl = document.createElement('style');
  styleEl.textContent = styles;
  shadowRoot.appendChild(styleEl);

  const root = createEl('div', 'coign-root coign-widget', {
    'data-position': config.position ?? 'bottom-right',
  });
  shadowRoot.appendChild(root);

  applyTheme(config.theme, root);

  // ---- Bubble -------------------------------------------------------
  bubbleEl = document.createElement('button');
  bubbleEl.className = 'coign-bubble';
  bubbleEl.setAttribute('aria-label', 'Open chat');
  bubbleEl.innerHTML =
    '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/></svg>';
  bubbleEl.addEventListener('click', openPanel);
  root.appendChild(bubbleEl);

  // ---- Panel --------------------------------------------------------
  panelEl = createEl('div', 'coign-panel', {
    role: 'dialog',
    'aria-modal': 'true',
    'aria-labelledby': 'coign-panel-title',
  });

  // Header
  const header = createEl('div', 'coign-panel-header');

  const titleWrap = createEl('div', 'coign-panel-title-wrap');
  const statusDot = createEl('span', 'coign-status-dot', { 'aria-hidden': 'true' });
  statusDot.dataset.status = 'loading';
  titleWrap.appendChild(statusDot);
  const title = createEl('h2', 'coign-panel-title', { id: 'coign-panel-title' });
  title.textContent = 'Coign';
  titleWrap.appendChild(title);
  header.appendChild(titleWrap);

  const closeBtn = createEl('button', 'coign-close', { 'aria-label': 'Close chat' });
  closeBtn.textContent = '\u00d7';
  closeBtn.addEventListener('click', closePanel);
  header.appendChild(closeBtn);
  panelEl.appendChild(header);

  // Messages
  messagesEl = createEl('div', 'coign-messages', {
    role: 'log',
    'aria-live': 'polite',
    'aria-relevant': 'additions',
  });
  panelEl.appendChild(messagesEl);

  // Welcome message
  if (config.welcome) {
    const welcomeText = typeof config.welcome === 'string' ? config.welcome : config.welcome.message;
    if (welcomeText) addAssistantMessage(welcomeText);
  }

  // Form
  formEl = document.createElement('form');
  formEl.className = 'coign-form';

  inputEl = document.createElement('input');
  inputEl.className = 'coign-input';
  inputEl.type = 'text';
  inputEl.placeholder = 'Ask a question\u2026';
  inputEl.setAttribute('aria-label', 'Message');
  formEl.appendChild(inputEl);

  const sendBtn = createEl('button', 'coign-send', {
    type: 'submit',
    'aria-label': 'Send',
  });
  sendBtn.innerHTML =
    '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" width="16" height="16"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>';
  formEl.appendChild(sendBtn);

  formEl.addEventListener('submit', (e) => {
    e.preventDefault();
    if (isThinking) return;
    const value = inputEl!.value.trim();
    if (!value) return;
    inputEl!.value = '';
    addUserMessage(value);
    setThinking(true);
    if (onSubmitCallback) onSubmitCallback(value);
  });

  panelEl.appendChild(formEl);
  root.appendChild(panelEl);

  // Attach loading overlay inside the panel
  attachLoadingOverlay(panelEl);

  // Status dot follows engine state
  on('downloadStart', () => setStatus('loading'));
  on('ready', () => setStatus('ready'));
  on('error', () => setStatus('error'));

  document.body.appendChild(hostElement);

  // ---- Global listeners ---------------------------------------------
  keydownHandler = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && isPanelOpen) {
      e.stopPropagation();
      closePanel();
    }
  };
  document.addEventListener('keydown', keydownHandler);

  resizeHandler = () => {
    const isMobile = window.innerWidth < 720;
    root.classList.toggle('coign-mobile', isMobile);
  };
  window.addEventListener('resize', resizeHandler);
  resizeHandler();
}

/* ------------------------------------------------------------------ */
/*  Thinking / status helpers                                         */
/* ------------------------------------------------------------------ */

export function setThinking(thinking: boolean): void {
  isThinking = thinking;

  if (inputEl) {
    inputEl.disabled = thinking;
    inputEl.placeholder = thinking ? 'Thinking\u2026' : 'Ask a question\u2026';
  }

  const sendBtn = formEl?.querySelector('.coign-send') as HTMLButtonElement | null;
  if (sendBtn) sendBtn.disabled = thinking;

  if (thinking) {
    if (!thinkingMsgEl) {
      thinkingMsgEl = createEl('div', 'coign-message coign-message--assistant coign-message--thinking');
      const avatar = createEl('div', 'coign-message-avatar');
      avatar.textContent = 'A';
      thinkingMsgEl.appendChild(avatar);
      const contentWrap = createEl('div', 'coign-message-content');
      const textEl = createEl('div', 'coign-message-text');
      textEl.textContent = 'Thinking\u2026';
      contentWrap.appendChild(textEl);
      thinkingMsgEl.appendChild(contentWrap);
      messagesEl?.appendChild(thinkingMsgEl);
      messagesEl && (messagesEl.scrollTop = messagesEl.scrollHeight);
    }
  } else {
    if (thinkingMsgEl) {
      thinkingMsgEl.remove();
      thinkingMsgEl = null;
    }
  }
}

export function setStatus(status: 'loading' | 'ready' | 'error'): void {
  const dot = shadowRoot?.querySelector('.coign-status-dot') as HTMLElement | null;
  if (dot) dot.dataset.status = status;
}

/* ------------------------------------------------------------------ */
/*  Theming                                                           */
/* ------------------------------------------------------------------ */

export function applyTheme(theme: CoignTheme | undefined, root?: HTMLElement): void {
  const target = root ?? (shadowRoot?.querySelector('.coign-widget') as HTMLElement | null);
  if (!target) return;
  if (!theme) return;
  if (theme.accent) target.style.setProperty('--coign-accent', theme.accent);
  if (theme.text) target.style.setProperty('--coign-text', theme.text);
  if (theme.bg) target.style.setProperty('--coign-bg', theme.bg);
  if (theme.radius !== undefined) target.style.setProperty('--coign-radius', `${theme.radius}px`);
}

/* ------------------------------------------------------------------ */
/*  destroyWidget                                                     */
/* ------------------------------------------------------------------ */

export function destroyWidget(): void {
  detachLoadingOverlay();

  if (focusTrapCleanup) {
    focusTrapCleanup();
    focusTrapCleanup = null;
  }

  if (keydownHandler) {
    document.removeEventListener('keydown', keydownHandler);
    keydownHandler = null;
  }
  if (resizeHandler) {
    window.removeEventListener('resize', resizeHandler);
    resizeHandler = null;
  }

  if (hostElement) {
    hostElement.remove();
    hostElement = null;
  }

  shadowRoot = null;
  bubbleEl = null;
  panelEl = null;
  messagesEl = null;
  formEl = null;
  inputEl = null;
  onSubmitCallback = null;
  isPanelOpen = false;
  isInline = false;
  originalParent = null;
  lastFocusedElement = null;
  isThinking = false;
  thinkingMsgEl = null;
}

/* ------------------------------------------------------------------ */
/*  showWidget / hideWidget                                           */
/* ------------------------------------------------------------------ */

export function showWidget(): void {
  hostElement?.classList.remove('coign-host--hidden');
}

export function hideWidget(): void {
  hostElement?.classList.add('coign-host--hidden');
}

/* ------------------------------------------------------------------ */
/*  openPanel / closePanel                                            */
/* ------------------------------------------------------------------ */

export function openPanel(): void {
  if (!panelEl || isPanelOpen) return;
  if (isInline) {
    // panel is always open in inline mode
    return;
  }

  isPanelOpen = true;
  lastFocusedElement = document.activeElement;

  panelEl.classList.add('coign-panel--open');
  bubbleEl?.classList.add('coign-bubble--hidden');

  // Focus input after animation
  requestAnimationFrame(() => {
    inputEl?.focus();
  });

  focusTrapCleanup = startFocusTrap(panelEl);
}

export function closePanel(): void {
  if (!panelEl || !isPanelOpen) return;
  if (isInline) {
    // panel stays open in inline mode
    return;
  }

  isPanelOpen = false;
  panelEl.classList.remove('coign-panel--open');
  bubbleEl?.classList.remove('coign-bubble--hidden');

  if (focusTrapCleanup) {
    focusTrapCleanup();
    focusTrapCleanup = null;
  }

  if (lastFocusedElement && 'focus' in lastFocusedElement) {
    (lastFocusedElement as HTMLElement).focus();
  }
  lastFocusedElement = null;
}

/* ------------------------------------------------------------------ */
/*  mountInline / unmountInline                                       */
/* ------------------------------------------------------------------ */

export function mountInline(selector: string): void {
  if (!hostElement || !shadowRoot) return;

  const target = document.querySelector(selector);
  if (!target) {
    console.warn(`[Coign] mountInline: selector "${selector}" not found.`);
    return;
  }

  const root = shadowRoot.querySelector('.coign-widget') as HTMLElement | null;
  if (!root) return;

  if (!isInline) {
    originalParent = hostElement.parentElement as HTMLElement;
  }

  isInline = true;
  target.appendChild(hostElement);
  root.classList.add('coign--inline');

  bubbleEl?.classList.add('coign-bubble--hidden');
  panelEl?.classList.add('coign-panel--inline-open');

  requestAnimationFrame(() => {
    inputEl?.focus();
  });
}

export function unmountInline(): void {
  if (!hostElement || !isInline) return;

  const root = shadowRoot?.querySelector('.coign-widget') as HTMLElement | null;
  if (root) root.classList.remove('coign--inline');

  if (originalParent && !originalParent.contains(hostElement)) {
    originalParent.appendChild(hostElement);
  } else if (hostElement.parentElement !== document.body) {
    document.body.appendChild(hostElement);
  }

  isInline = false;
  bubbleEl?.classList.remove('coign-bubble--hidden');
  panelEl?.classList.remove('coign-panel--inline-open');
}

/* ------------------------------------------------------------------ */
/*  Message helpers                                                   */
/* ------------------------------------------------------------------ */

export function addUserMessage(content: string): void {
  addMessage('user', content);
}

export function addAssistantMessage(content: string): void {
  setThinking(false);
  addMessage('assistant', content);
}

export function addToolCallMessage(toolName: string, args?: string): void {
  const text = args ? `${toolName}\n${args}` : toolName;
  addMessage('tool', text, `Call: ${toolName}`);
}

export function addToolResultMessage(toolName: string, result?: string): void {
  const text = result ?? '(no result)';
  addMessage('tool', text, `Result: ${toolName}`);
}

export function clearMessages(): void {
  if (!messagesEl) return;
  messagesEl.innerHTML = '';
}

function addMessage(role: 'user' | 'assistant' | 'tool', content: string, label?: string): void {
  if (!messagesEl) return;

  const msg = createEl('div', `coign-message coign-message--${role}`);

  const avatar = createEl('div', 'coign-message-avatar');
  avatar.textContent = role === 'user' ? 'U' : role === 'assistant' ? 'A' : 'T';
  msg.appendChild(avatar);

  const contentWrap = createEl('div', 'coign-message-content');

  if (label) {
    const labelEl = createEl('div', 'coign-message-tool-label');
    labelEl.textContent = label;
    contentWrap.appendChild(labelEl);
  }

  const textEl = createEl('div', 'coign-message-text');
  textEl.textContent = content;
  contentWrap.appendChild(textEl);

  msg.appendChild(contentWrap);
  messagesEl.appendChild(msg);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

/* ------------------------------------------------------------------ */
/*  Focus trap                                                        */
/* ------------------------------------------------------------------ */

function startFocusTrap(container: HTMLElement): () => void {
  const selector =
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

  const getFocusable = (): HTMLElement[] =>
    Array.from(container.querySelectorAll(selector)).filter(
      (el) => !el.hasAttribute('disabled') && (el as HTMLElement).tabIndex >= 0
    ) as HTMLElement[];

  const onKeydown = (e: KeyboardEvent) => {
    if (e.key !== 'Tab') return;
    const els = getFocusable();
    if (els.length === 0) return;
    const first = els[0];
    const last = els[els.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  container.addEventListener('keydown', onKeydown);

  // focus first focusable element
  const els = getFocusable();
  if (els.length > 0) {
    els[0].focus();
  }

  return () => {
    container.removeEventListener('keydown', onKeydown);
  };
}

/* ------------------------------------------------------------------ */
/*  Inline style for host visibility                                  */
/* ------------------------------------------------------------------ */

const hostStyle = document.createElement('style');
hostStyle.textContent = `
  #coign-widget-host.coign-host--hidden { display: none !important; }
`;
document.head.appendChild(hostStyle);
