import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CommercialWorkspace } from "@/components/commercial-workspace";
import { CustomersWorkspace } from "@/components/customers-workspace";
import { FinanceWorkspace } from "@/components/finance-workspace";
import { InventoryWorkspace } from "@/components/inventory-workspace";
import { ModuleEmptyState } from "@/components/module-empty-state";
import { OperationsWorkspace } from "@/components/operations-workspace";
import { PurchasesWorkspace } from "@/components/purchases-workspace";
import { TeamsWorkspace } from "@/components/teams-workspace";
import { getModule, modules } from "@/lib/modules";

export function generateStaticParams() {
  return modules.map(({ slug }) => ({ module: slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ module: string }>;
}): Promise<Metadata> {
  const { module: slug } = await params;
  const currentModule = getModule(slug);
  return currentModule ? { title: currentModule.title } : {};
}

export default async function ModulePage({
  params,
}: {
  params: Promise<{ module: string }>;
}) {
  const { module: slug } = await params;
  const currentModule = getModule(slug);
  if (!currentModule) notFound();

  if (slug === "inventory") {
    return <InventoryWorkspace key={slug} />;
  }
  if (slug === "products") {
    return <InventoryWorkspace key={slug} initialTab="products" />;
  }
  if (slug === "operations") {
    return <OperationsWorkspace key={slug} />;
  }
  if (slug === "customers") {
    return <CustomersWorkspace key={slug} />;
  }
  if (slug === "teams") {
    return <TeamsWorkspace key={slug} />;
  }
  if (slug === "purchases") {
    return <PurchasesWorkspace key={slug} />;
  }
  if (slug === "sales") {
    return <CommercialWorkspace key={slug} />;
  }
  if (slug === "finance") {
    return <FinanceWorkspace key={slug} />;
  }

  return <ModuleEmptyState module={currentModule} />;
}
