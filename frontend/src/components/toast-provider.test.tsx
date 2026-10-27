// @vitest-environment jsdom
import { render, screen, cleanup, act, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ToastProvider, useToast } from "./toast-provider";

function TestComponent() {
  const toast = useToast();
  return (
    <div>
      <button onClick={() => toast.success("Operação concluída com êxito!", "Show Criado")}>
        Disparar Sucesso
      </button>
      <button onClick={() => toast.error("Falha ao processar", "Erro Grave")}>
        Disparar Erro
      </button>
    </div>
  );
}

describe("ToastProvider", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("renderiza o toast de sucesso ao disparar evento e exibe mensagem", () => {
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: /disparar sucesso/i }));

    expect(screen.getByText("Show Criado")).toBeDefined();
    expect(screen.getByText("Operação concluída com êxito!")).toBeDefined();
  });

  it("permite fechar o toast manualmente ao clicar no botão fechar", () => {
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: /disparar erro/i }));
    expect(screen.getByText("Erro Grave")).toBeDefined();

    const closeBtn = screen.getByRole("button", { name: /fechar notificação/i });
    fireEvent.click(closeBtn);

    expect(screen.queryByText("Erro Grave")).toBeNull();
  });

  it("remove o toast automaticamente após a duração configurada", () => {
    vi.useFakeTimers();

    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: /disparar sucesso/i }));
    expect(screen.getByText("Show Criado")).toBeDefined();

    act(() => {
      vi.advanceTimersByTime(4500);
    });

    expect(screen.queryByText("Show Criado")).toBeNull();
  });
});
