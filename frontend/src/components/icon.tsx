import type { ModuleIcon } from "@/lib/modules";

type IconName = ModuleIcon | "home" | "menu" | "close" | "arrow" | "refresh" | "warning";

export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true as const,
  };

  switch (name) {
    case "home":
      return <svg {...common}><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z" /></svg>;
    case "shield":
      return <svg {...common}><path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11" /><path d="m9 12 2 2 4-4" /></svg>;
    case "warehouse":
      return <svg {...common}><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" /><path d="M7 21v-8h10v8M9 16h6" /></svg>;
    case "boxes":
      return <svg {...common}><path d="m12 3 9 5-9 5-9-5zM3 12l9 5 9-5M3 16l9 5 9-5M12 13v8" /></svg>;
    case "users":
      return <svg {...common}><path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M10 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM20 8v6m3-3h-6" /></svg>;
    case "spark":
      return <svg {...common}><path d="m12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-2-5.8L4 11l6-2.2zM19 14l1.2 3.2L23 18l-2.8 1-1.2 3-1.1-3-2.9-1 2.9-.8z" /></svg>;
    case "hardhat":
      return <svg {...common}><path d="M3 18a9 9 0 0 1 18 0M2 18h20v3H2zM12 9v5M7 12l-2 2M17 12l2 2" /></svg>;
    case "briefcase":
      return <svg {...common}><rect x="3" y="7" width="18" height="14" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18M10 12v2h4v-2" /></svg>;
    case "receipt":
      return <svg {...common}><path d="M4 3v18l2-1.5L8 21l2-1.5 2 1.5 2-1.5 2 1.5 2-1.5 2 1.5V3l-2 1.5L16 3l-2 1.5L12 3l-2 1.5L8 3 6 4.5zM9 9h6M9 13h6" /></svg>;
    case "chart":
      return <svg {...common}><path d="M3 3v18h18M8 15l4-4 4 3 5-7" /><path d="M17 7h4v4" /></svg>;
    case "settings":
      return <svg {...common}><circle cx="12" cy="12" r="3" /><path d="m19.4 15 .1.1 1.4 1.1-1.4 2.4-1.7-.7-.2.1-1.5.9-.3 1.8h-2.8l-.3-1.8-1.7-1-.2-.1-1.7.7-1.4-2.4 1.4-1.1v-.2a8 8 0 0 1 0-1.8v-.2l-1.4-1.1 1.4-2.4 1.7.7.2-.1 1.5-.9.3-1.8h2.8l.3 1.8 1.7 1 .2.1 1.7-.7 1.4 2.4-1.4 1.1v.2a8 8 0 0 1 0 1.8z" /></svg>;
    case "menu":
      return <svg {...common}><path d="M4 6h16M4 12h16M4 18h16" /></svg>;
    case "close":
      return <svg {...common}><path d="m18 6-12 12M6 6l12 12" /></svg>;
    case "arrow":
      return <svg {...common}><path d="M5 12h14M13 6l6 6-6 6" /></svg>;
    case "refresh":
      return <svg {...common}><path d="M20 7v5h-5M4 17v-5h5" /><path d="M5.6 9A7 7 0 0 1 18 6.5L20 12M4 12l2 5.5A7 7 0 0 0 18.4 15" /></svg>;
    case "warning":
      return <svg {...common}><path d="m10.3 3.9-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3.1l-8-14a2 2 0 0 0-3.4 0ZM12 9v4m0 4h.01" /></svg>;
  }
}
