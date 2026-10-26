// @vitest-environment jsdom
import { renderHook, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useModalFocusTrap } from "./use-modal-focus-trap";

function mountModal(): HTMLElement {
  const container = document.createElement("div");
  container.className = "modal-content";
  container.innerHTML = `
    <input id="first" />
    <input id="middle" />
    <button id="last">Salvar</button>
  `;
  document.body.appendChild(container);
  return container;
}

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
});

describe("useModalFocusTrap", () => {
  it("moves focus to the first focusable element when opened", () => {
    mountModal();
    renderHook(() => useModalFocusTrap(true));

    expect(document.activeElement?.id).toBe("first");
  });

  it("does nothing when closed", () => {
    mountModal();
    renderHook(() => useModalFocusTrap(false));

    expect(document.activeElement?.id).not.toBe("first");
  });

  it("wraps Tab from the last element back to the first", () => {
    mountModal();
    renderHook(() => useModalFocusTrap(true));

    const last = document.getElementById("last")!;
    last.focus();
    const event = new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true });
    document.querySelector(".modal-content")!.dispatchEvent(event);

    expect(document.activeElement?.id).toBe("first");
  });

  it("wraps Shift+Tab from the first element back to the last", () => {
    mountModal();
    renderHook(() => useModalFocusTrap(true));

    const first = document.getElementById("first")!;
    first.focus();
    const event = new KeyboardEvent("keydown", {
      key: "Tab",
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    });
    document.querySelector(".modal-content")!.dispatchEvent(event);

    expect(document.activeElement?.id).toBe("last");
  });
});
