import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ApiHealthProvider } from "@/components/api-health";
import { AppShell } from "@/components/app-shell";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Pirotécnico ERP",
    template: "%s · Pirotécnico ERP",
  },
  description: "Fundação de gestão e operações para empresas pirotécnicas.",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>
        <ApiHealthProvider>
          <AppShell>{children}</AppShell>
        </ApiHealthProvider>
      </body>
    </html>
  );
}
