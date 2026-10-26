// @vitest-environment jsdom
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OfxReconcileModal } from "./ofx-reconcile-modal";

describe("OfxReconcileModal", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("não renderiza nada quando isOpen é false", () => {
    const { container } = render(
      <OfxReconcileModal isOpen={false} onClose={() => {}} onSuccess={() => {}} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renderiza título, instruções e área de upload quando aberto", () => {
    render(<OfxReconcileModal isOpen={true} onClose={() => {}} onSuccess={() => {}} />);

    expect(screen.getByText("OFX / EXTRATO BANCÁRIO")).toBeDefined();
    expect(screen.getByText("Conciliação Bancária Automática")).toBeDefined();
    expect(
      screen.getByText(/Selecione o arquivo de extrato bancário padrão/),
    ).toBeDefined();
    expect(screen.getByText("Escolher arquivo .ofx")).toBeDefined();
  });

  it("chama onClose ao clicar no botão fechar", () => {
    const handleClose = vi.fn();
    render(<OfxReconcileModal isOpen={true} onClose={handleClose} onSuccess={() => {}} />);

    const closeBtn = screen.getByLabelText("Fechar modal de conciliação bancária");
    fireEvent.click(closeBtn);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});
