"use client";

import { useState, type FormEvent } from "react";
import {
  complianceApi,
  fiscalApi,
  financeApi,
  type FiscalDocument,
  type GeneratedPix,
  type ServiceOrder,
} from "@/lib/api";
import { useToast } from "@/components/toast-provider";

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Não foi possível concluir a operação.";
}

export function useOperationsModals(
  selected: ServiceOrder | null,
  reload: () => void,
) {
  const toast = useToast();

  const [isGtModalOpen, setIsGtModalOpen] = useState(false);
  const [gtOriginCity, setGtOriginCity] = useState("Fortaleza");
  const [gtOriginState, setGtOriginState] = useState("CE");
  const [gtDestCity, setGtDestCity] = useState("");
  const [gtDestState, setGtDestState] = useState("CE");
  const [gtPlate, setGtPlate] = useState("POX-9A12");
  const [gtPlateState, setGtPlateState] = useState("CE");
  const [gtDriverName, setGtDriverName] = useState("Raimundo Nonato Arruda");
  const [gtDriverCpf, setGtDriverCpf] = useState("123.456.789-00");
  const [gtDriverLicense, setGtDriverLicense] = useState("987654321-CE");
  const [gtRoute, setGtRoute] = useState(
    "Partida Paiol Central -> BR-116 -> Destino",
  );
  const [gtSubmitting, setGtSubmitting] = useState(false);
  const [gtError, setGtError] = useState<string | null>(null);

  const [isNfseModalOpen, setIsNfseModalOpen] = useState(false);
  const [nfseSubmitting, setNfseSubmitting] = useState(false);
  const [nfseError, setNfseError] = useState<string | null>(null);
  const [nfseSuccess, setNfseSuccess] = useState<FiscalDocument | null>(null);

  const [isPixModalOpen, setIsPixModalOpen] = useState(false);
  const [pixData, setPixData] = useState<GeneratedPix | null>(null);
  const [pixLoading, setPixLoading] = useState(false);

  const [isBurningOrderModalOpen, setIsBurningOrderModalOpen] = useState(false);

  function handleOpenGtModal() {
    if (!selected) return;
    setGtError(null);
    setGtRoute(`Transporte de PCE para espetáculo em ${selected.eventLocation}`);
    setIsGtModalOpen(true);
  }

  async function handleSubmitGt(e: FormEvent) {
    e.preventDefault();
    if (!selected || selected.items.length === 0) return;
    setGtSubmitting(true);
    setGtError(null);
    try {
      const firstMagazineId = selected.items[0]?.productLot.magazineId;
      if (!firstMagazineId) {
        throw new Error("Lote sem paiol vinculado.");
      }
      const gt = await complianceApi.createTrafficGuide({
        serviceOrderId: selected.id,
        sourceMagazineId: firstMagazineId,
        validFrom: new Date().toISOString(),
        validUntil: new Date(Date.now() + 7 * 86400000).toISOString(),
        originCity: gtOriginCity,
        originState: gtOriginState,
        destinationCity: gtDestCity,
        destinationState: gtDestState,
        routeDescription: gtRoute,
        vehiclePlate: gtPlate,
        vehiclePlateState: gtPlateState,
        driverName: gtDriverName,
        driverCpf: gtDriverCpf,
        driverLicense: gtDriverLicense,
        hasMopp: true,
        blasterId: selected.responsibleBlasterId ?? undefined,
        items: selected.items.map((i) => ({
          productId: i.productId,
          productLotId: i.productLotId,
          quantity: Number(i.plannedQuantity),
        })),
      });

      setIsGtModalOpen(false);
      toast.success(
        `Guia de Tráfego #${gt.number} emitida com sucesso para o transporte militar!`,
      );
      reload();
    } catch (err) {
      setGtError(errorMessage(err));
    } finally {
      setGtSubmitting(false);
    }
  }

  function handleOpenNfseModal() {
    if (!selected) return;
    setNfseError(null);
    setNfseSuccess(null);
    setIsNfseModalOpen(true);
  }

  async function handleSubmitNfse(e: FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setNfseSubmitting(true);
    setNfseError(null);
    try {
      const doc = await fiscalApi.emitNFSe({
        serviceOrderId: selected.id,
        serviceDescription: `Espetáculo Pirotécnico em ${selected.eventLocation}. Blaster: ${selected.responsibleBlaster?.name ?? "Técnico"} - ART: ${selected.artNumber ?? "S/N"}.`,
      });
      setNfseSuccess(doc);
      toast.success(
        `NFS-e #${doc.number} emitida e autorizada com sucesso na Prefeitura!`,
      );
      reload();
      setTimeout(() => setIsNfseModalOpen(false), 2000);
    } catch (err) {
      setNfseError(errorMessage(err));
    } finally {
      setNfseSubmitting(false);
    }
  }

  async function handleOpenPix() {
    if (!selected) return;
    setPixLoading(true);
    try {
      const entriesRes = await financeApi.getEntries(1, "RECEBER");
      const entry = entriesRes.data.find(
        (e) => e.serviceOrderId === selected.id,
      );
      if (!entry) {
        throw new Error(
          "Título a receber ainda não localizado para esta OS. Verifique no Financeiro.",
        );
      }
      const generated = await financeApi.generatePix(entry.id);
      setPixData(generated);
      setIsPixModalOpen(true);
    } catch (err) {
      toast.error(`Aviso financeiro: ${errorMessage(err)}`);
    } finally {
      setPixLoading(false);
    }
  }

  return {
    isGtModalOpen,
    setIsGtModalOpen,
    gtOriginCity,
    setGtOriginCity,
    gtOriginState,
    setGtOriginState,
    gtDestCity,
    setGtDestCity,
    gtDestState,
    setGtDestState,
    gtPlate,
    setGtPlate,
    gtPlateState,
    setGtPlateState,
    gtDriverName,
    setGtDriverName,
    gtDriverCpf,
    setGtDriverCpf,
    gtDriverLicense,
    setGtDriverLicense,
    gtRoute,
    setGtRoute,
    gtSubmitting,
    gtError,
    handleOpenGtModal,
    handleSubmitGt,
    isNfseModalOpen,
    setIsNfseModalOpen,
    nfseSubmitting,
    nfseError,
    nfseSuccess,
    handleOpenNfseModal,
    handleSubmitNfse,
    isPixModalOpen,
    setIsPixModalOpen,
    pixData,
    pixLoading,
    handleOpenPix,
    isBurningOrderModalOpen,
    setIsBurningOrderModalOpen,
  };
}
