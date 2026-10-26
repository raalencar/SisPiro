// @vitest-environment jsdom
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PixModal } from "./pix-modal";
import type { GeneratedPix } from "@/lib/api";

const mockPixData: GeneratedPix = {
  entryId: "entry-123",
  txid: "SPP0001045TEST99",
  amount: 450.8,
  copyPasteCode: "00020126360014br.gov.bcb.pix0114123456780001905204000053039865406450.805802BR5915CASA DE FOGOS 6009SAO PAULO62110507TEST1236304A1B2",
  qrCodeDataUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  expiresAt: new Date(Date.now() + 86400000).toISOString(),
};

describe("PixModal", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("não renderiza nada quando isOpen é false", () => {
    const { container } = render(
      <PixModal isOpen={false} pixData={mockPixData} onClose={() => {}} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renderiza valor a pagar, txid, qr code e botão copiar quando aberto", () => {
    render(<PixModal isOpen={true} pixData={mockPixData} onClose={() => {}} />);

    expect(screen.getByText("PIX DINÂMICO")).toBeDefined();
    expect(screen.getByText("Cobrança Instantânea")).toBeDefined();
    expect(screen.getByText(/450,80/)).toBeDefined();
    expect(screen.getByText("SPP0001045TEST99")).toBeDefined();

    const img = screen.getByAltText("QR Code PIX para pagamento");
    expect(img).toBeDefined();
    expect(img.getAttribute("src")).toContain("data:image/png;base64");

    const copyBtn = screen.getByText("Copiar");
    expect(copyBtn).toBeDefined();
  });

  it("chama onClose ao clicar no botão fechar", () => {
    const handleClose = vi.fn();
    render(<PixModal isOpen={true} pixData={mockPixData} onClose={handleClose} />);

    const closeBtn = screen.getByLabelText("Fechar modal de cobrança PIX");
    fireEvent.click(closeBtn);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});
