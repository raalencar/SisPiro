"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import { Icon } from "@/components/icon";

export type ToastType = "success" | "error" | "warning" | "info";

export interface Toast {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  duration?: number;
}

interface ToastContextValue {
  toasts: Toast[];
  showToast: (toast: Omit<Toast, "id">) => string;
  dismissToast: (id: string) => void;
  success: (message: string, title?: string) => string;
  error: (message: string, title?: string) => string;
  warning: (message: string, title?: string) => string;
  info: (message: string, title?: string) => string;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const defaultToastContext: ToastContextValue = {
  toasts: [],
  showToast: () => "",
  dismissToast: () => {},
  success: () => "",
  error: () => "",
  warning: () => "",
  info: () => "",
};

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  return context ?? defaultToastContext;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    ({ type, title, message, duration = 4000 }: Omit<Toast, "id">) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const newToast: Toast = { id, type, title, message, duration };

      setToasts((prev) => [...prev, newToast]);

      if (duration > 0) {
        setTimeout(() => {
          dismissToast(id);
        }, duration);
      }

      return id;
    },
    [dismissToast],
  );

  const success = useCallback(
    (message: string, title?: string) =>
      showToast({ type: "success", title: title ?? "Sucesso", message }),
    [showToast],
  );

  const error = useCallback(
    (message: string, title?: string) =>
      showToast({ type: "error", title: title ?? "Atenção", message }),
    [showToast],
  );

  const warning = useCallback(
    (message: string, title?: string) =>
      showToast({ type: "warning", title: title ?? "Aviso", message }),
    [showToast],
  );

  const info = useCallback(
    (message: string, title?: string) =>
      showToast({ type: "info", title: title ?? "Informação", message }),
    [showToast],
  );

  return (
    <ToastContext.Provider
      value={{
        toasts,
        showToast,
        dismissToast,
        success,
        error,
        warning,
        info,
      }}
    >
      {children}
      <aside
        className="toast-container"
        aria-label="Notificações do sistema"
        aria-live="polite"
        role="region"
      >
        {toasts.map((toast) => {
          const iconName =
            toast.type === "success"
              ? "check"
              : toast.type === "error"
                ? "close"
                : toast.type === "warning"
                  ? "warning"
                  : "spark";

          return (
            <div
              key={toast.id}
              className={`toast-item toast-item--${toast.type}`}
              role="status"
            >
              <div className="toast-item__icon" aria-hidden="true">
                <Icon name={iconName} size={18} />
              </div>
              <div className="toast-item__content">
                {toast.title && <strong>{toast.title}</strong>}
                <p>{toast.message}</p>
              </div>
              <button
                type="button"
                className="toast-item__close"
                onClick={() => dismissToast(toast.id)}
                aria-label="Fechar notificação"
              >
                <Icon name="close" size={14} />
              </button>
            </div>
          );
        })}
      </aside>
    </ToastContext.Provider>
  );
}
