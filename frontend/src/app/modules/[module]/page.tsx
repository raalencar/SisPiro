import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ModuleEmptyState } from "@/components/module-empty-state";
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

  return <ModuleEmptyState module={currentModule} />;
}
