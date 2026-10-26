// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useEscapeToClose } from "./use-escape-to-close";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useEscapeToClose", () => {
  it("calls onClose when Escape is pressed while open", () => {
    const onClose = vi.fn();
    renderHook(() => useEscapeToClose(true, onClose));

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does nothing when closed", () => {
    const onClose = vi.fn();
    renderHook(() => useEscapeToClose(false, onClose));

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));

    expect(onClose).not.toHaveBeenCalled();
  });

  it("ignores other keys", () => {
    const onClose = vi.fn();
    renderHook(() => useEscapeToClose(true, onClose));

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));

    expect(onClose).not.toHaveBeenCalled();
  });
});
