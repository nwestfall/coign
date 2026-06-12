/**
 * Confirmation <dialog> for write / destructive tool risk tiers.
 * Phase 2 deliverable.
 */

import styles from './styles.css?inline';

let currentDialog: HTMLDialogElement | null = null;

/**
 * Show a confirmation dialog for a risky tool call.
 *
 * @param message   Human-readable description of what the tool wants to do.
 * @param risk      Risk tier — 'write' shows Allow/Deny; 'destructive'
 *                  requires typing {@link confirmationValue} to enable Allow.
 * @param confirmationValue  For destructive risk, the exact string the user
 *                           must type into the confirmation input.
 * @returns Promise resolving to `true` if the user allowed the action.
 */
export function showConfirmDialog(
  message: string,
  risk: 'read' | 'write' | 'destructive',
  confirmationValue?: string
): Promise<boolean> {
  return new Promise((resolve) => {
    if (currentDialog) {
      currentDialog.close();
      currentDialog.remove();
    }

    const dialog = document.createElement('dialog');
    dialog.className = 'coign-root coign-modal';

    // Inject styles so the dialog is self-contained
    const styleEl = document.createElement('style');
    styleEl.textContent = styles;
    dialog.appendChild(styleEl);

    // Content wrapper
    const content = createEl('div', 'coign-modal-content');

    const title = createEl('h2', 'coign-modal-title');
    title.textContent =
      risk === 'destructive' ? 'Confirm Destructive Action' : 'Confirm Action';
    content.appendChild(title);

    const msg = createEl('p', 'coign-modal-message');
    msg.textContent = message;
    content.appendChild(msg);

    let confirmInput: HTMLInputElement | null = null;

    if (risk === 'destructive' && confirmationValue) {
      const label = createEl('label', 'coign-modal-label');
      label.textContent = `Type "${confirmationValue}" to confirm:`;

      confirmInput = document.createElement('input');
      confirmInput.className = 'coign-modal-input';
      confirmInput.type = 'text';
      confirmInput.setAttribute('aria-label', 'Type confirmation');
      label.appendChild(confirmInput);
      content.appendChild(label);
    }

    // Buttons
    const buttons = createEl('div', 'coign-modal-buttons');

    const denyBtn = document.createElement('button');
    denyBtn.className = 'coign-modal-btn coign-modal-btn--deny';
    denyBtn.textContent = 'Deny';
    denyBtn.addEventListener('click', () => {
      cleanup();
      resolve(false);
    });
    buttons.appendChild(denyBtn);

    const allowBtn = document.createElement('button');
    allowBtn.className = 'coign-modal-btn coign-modal-btn--allow';
    allowBtn.textContent = 'Allow';
    allowBtn.addEventListener('click', () => {
      cleanup();
      resolve(true);
    });
    buttons.appendChild(allowBtn);

    // Destructive: disable Allow until typed confirmation matches
    if (risk === 'destructive' && confirmInput && confirmationValue) {
      allowBtn.disabled = true;
      allowBtn.classList.add('coign-modal-btn--disabled');
      confirmInput.addEventListener('input', () => {
        const match = confirmInput!.value.trim() === confirmationValue;
        allowBtn.disabled = !match;
        allowBtn.classList.toggle('coign-modal-btn--disabled', !match);
      });
    }

    content.appendChild(buttons);
    dialog.appendChild(content);
    document.body.appendChild(dialog);
    currentDialog = dialog;

    // Focus trap + initial focus
    const focusable = Array.from(
      dialog.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
    ).filter((el) => !el.hasAttribute('disabled') && (el as HTMLElement).tabIndex >= 0) as HTMLElement[];

    if (focusable.length > 0) {
      focusable[0].focus();
    }

    const onKeydown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        cleanup();
        resolve(false);
        return;
      }
      if (e.key === 'Tab' && focusable.length > 0) {
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    dialog.addEventListener('keydown', onKeydown);
    dialog.addEventListener('close', () => {
      cleanup();
      resolve(false);
    });

    dialog.showModal();

    function cleanup() {
      if (currentDialog === dialog) currentDialog = null;
      dialog.removeEventListener('keydown', onKeydown);
      if (dialog.isConnected) {
        dialog.close();
        dialog.remove();
      }
    }
  });
}

/* ------------------------------------------------------------------ */
/*  DOM helper                                                        */
/* ------------------------------------------------------------------ */

function createEl(tag: string, cls?: string, attrs?: Record<string, string>): HTMLElement {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  }
  return el;
}
