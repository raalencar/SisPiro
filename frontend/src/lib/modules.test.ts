import { describe, expect, it } from "vitest";
import { getModule, hasModuleAccess, modules } from "./modules";

describe("hasModuleAccess", () => {
  it("allows access when the module has no required roles", () => {
    const settings = getModule("settings")!;
    expect(hasModuleAccess(settings, [])).toBe(true);
  });

  it("denies access when the user lacks the required role", () => {
    const finance = getModule("finance")!;
    expect(hasModuleAccess(finance, ["ESTOQUE"])).toBe(false);
  });

  it("allows access when the user has the required role", () => {
    const finance = getModule("finance")!;
    expect(hasModuleAccess(finance, ["FINANCEIRO"])).toBe(true);
  });

  it("always allows ADMIN regardless of the module's required roles", () => {
    const finance = getModule("finance")!;
    expect(hasModuleAccess(finance, ["ADMIN"])).toBe(true);
  });

  it("declares a requiredRoles entry for every integrated module", () => {
    const integrated = modules.filter(
      (module) => module.statusLabel === "Tela integrada",
    );
    for (const module of integrated) {
      expect(module.requiredRoles?.length, module.slug).toBeGreaterThan(0);
    }
  });
});
