"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import type { ReactNode } from "react";
import { ApiHealthIndicator } from "@/components/api-health";
import { Icon } from "@/components/icon";
import { modules } from "@/lib/modules";

const groupOrder = ["Governança", "Cadastros", "Operações", "Gestão", "Sistema"];

function AppNavigation({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="primary-nav flex flex-1 flex-col" aria-label="Navegação principal">
      <Link
        href="/"
        className={`nav-link ${pathname === "/" ? "nav-link--active" : ""}`}
        aria-current={pathname === "/" ? "page" : undefined}
        onClick={onNavigate}
      >
        <Icon name="home" size={19} />
        <span>Visão geral</span>
      </Link>
      {groupOrder.map((group) => {
        const groupModules = modules.filter((item) => item.group === group);
        return (
          <div className="nav-group" key={group}>
            <p className="nav-group__label">{group}</p>
            {groupModules.map((item) => {
              const href = `/modules/${item.slug}`;
              const active = pathname === href;
              return (
                <Link
                  className={`nav-link ${active ? "nav-link--active" : ""}`}
                  href={href}
                  key={item.slug}
                  aria-current={active ? "page" : undefined}
                  onClick={onNavigate}
                >
                  <Icon name={item.icon} size={19} />
                  <span>{item.shortTitle}</span>
                </Link>
              );
            })}
          </div>
        );
      })}
    </nav>
  );
}

function Brand() {
  return (
    <Link className="brand" href="/" aria-label="Pirotécnico ERP, página inicial">
      <span className="brand-mark" aria-hidden="true">
        <span />
        <span />
        <span />
      </span>
      <span className="brand-copy">
        <strong>Pirotécnico</strong>
        <span>GESTÃO & OPERAÇÕES</span>
      </span>
    </Link>
  );
}

function Breadcrumbs() {
  const pathname = usePathname();
  const currentModule = modules.find((item) => pathname === `/modules/${item.slug}`);
  const current = currentModule?.title ?? "Visão geral";

  return (
    <nav className="breadcrumbs" aria-label="Trilha de navegação">
      {currentModule && <span>ERP</span>}
      {currentModule && <span className="breadcrumbs__separator" aria-hidden="true">/</span>}
      <span aria-current="page">{current}</span>
    </nav>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const menuTrigger = useRef<HTMLButtonElement>(null);
  const mobileNavigation = useRef<HTMLElement>(null);
  const closeMenu = () => {
    setMobileMenuOpen(false);
    menuTrigger.current?.focus();
  };

  useEffect(() => {
    if (mobileMenuOpen) {
      mobileNavigation.current?.querySelector<HTMLElement>("a[href]")?.focus();
    }
  }, [mobileMenuOpen]);

  const handleMenuKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      closeMenu();
      return;
    }

    if (event.key !== "Tab" || !mobileNavigation.current) return;
    const focusableElements = mobileNavigation.current.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled])',
    );
    const first = focusableElements.item(0);
    const last = focusableElements.item(focusableElements.length - 1);

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <div className="app-shell min-h-screen">
      <aside className="sidebar">
        <Brand />
        <AppNavigation />
        <div className="sidebar-footer">
          <div className="sidebar-footer__mark">
            <Icon name="shield" size={17} />
          </div>
          <div>
            <strong>Segurança em primeiro lugar</strong>
            <span>Dados regulatórios dependem da API.</span>
          </div>
        </div>
      </aside>

      {mobileMenuOpen && (
        <button
          className="mobile-scrim"
          type="button"
          onClick={closeMenu}
          aria-label="Fechar menu"
        />
      )}
      <aside
        id="mobile-navigation"
        ref={mobileNavigation}
        className={`mobile-sidebar ${mobileMenuOpen ? "mobile-sidebar--open" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label="Navegação principal"
        aria-hidden={!mobileMenuOpen}
        inert={!mobileMenuOpen}
        onKeyDown={handleMenuKeyDown}
      >
        <div className="mobile-sidebar__top">
          <Brand />
          <button
            type="button"
            className="icon-button"
            onClick={closeMenu}
            aria-label="Fechar menu de navegação"
          >
            <Icon name="close" />
          </button>
        </div>
        <AppNavigation onNavigate={closeMenu} />
      </aside>

      <div className="main-column">
        <header className="topbar">
          <button
            ref={menuTrigger}
            type="button"
            className="icon-button mobile-menu-button"
            aria-label="Abrir menu de navegação"
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-navigation"
            onClick={() => setMobileMenuOpen(true)}
          >
            <Icon name="menu" />
          </button>
          <Breadcrumbs />
          <div className="topbar__right">
            <span className="environment-label">
              <span className="environment-label__dot" aria-hidden="true" />
              Ambiente de desenvolvimento
            </span>
            <ApiHealthIndicator />
          </div>
        </header>
        <div className="auth-notice" role="note">
          <Icon name="warning" size={16} />
          <span>
            Autenticação ainda não integrada. Este frontend não restringe o acesso a dados.
          </span>
        </div>
        <main className="page-content mx-auto w-full">{children}</main>
        <footer className="page-footer">
          <span>Pirotécnico ERP</span>
          <span>Fundação de interface · integração de negócio pendente</span>
        </footer>
      </div>
    </div>
  );
}
