import { useEffect } from "react";

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function focusableElements(container: HTMLElement): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)];
}

/**
 * Moves focus into the open modal and traps Tab/Shift+Tab within it.
 * Queries the single `.modal-content` expected to be open at a time —
 * every workspace modal uses that class and only one is ever open.
 */
export function useModalFocusTrap(isOpen: boolean): void {
  useEffect(() => {
    if (!isOpen) return;
    const container = document.querySelector<HTMLElement>(".modal-content");
    if (!container) return;

    const els = focusableElements(container);
    (els[0] ?? container).focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Tab" || !container) return;
      const current = focusableElements(container);
      if (current.length === 0) return;
      const first = current[0];
      const last = current[current.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    container.addEventListener("keydown", handleKeyDown);
    return () => container.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);
}
