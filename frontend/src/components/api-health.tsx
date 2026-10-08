"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { ApiError, getLiveness, getReadiness } from "@/lib/api";
import { Icon } from "@/components/icon";

type CheckState = {
  status: "checking" | "available" | "error";
  message: string;
};

type HealthState = {
  live: CheckState;
  ready: CheckState;
  checkedAt: Date | null;
};

type ApiHealthContextValue = HealthState & { refresh: () => Promise<void> };

const checking: CheckState = { status: "checking", message: "Verificando..." };
const ApiHealthContext = createContext<ApiHealthContextValue | null>(null);

async function check(
  request: () => Promise<unknown>,
): Promise<CheckState> {
  try {
    await request();
    return { status: "available", message: "Disponível" };
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof ApiError
          ? error.message
          : "Não foi possível validar a resposta da API.",
    };
  }
}

export function ApiHealthProvider({ children }: { children: ReactNode }) {
  const [health, setHealth] = useState<HealthState>({
    live: checking,
    ready: checking,
    checkedAt: null,
  });

  const refresh = useCallback(async () => {
    setHealth((current) => ({
      ...current,
      live: checking,
      ready: checking,
    }));
    const [live, ready] = await Promise.all([check(getLiveness), check(getReadiness)]);
    setHealth({ live, ready, checkedAt: new Date() });
  }, []);

  useEffect(() => {
    let active = true;
    void Promise.all([check(getLiveness), check(getReadiness)]).then(([live, ready]) => {
      if (active) {
        setHealth({ live, ready, checkedAt: new Date() });
      }
    });

    return () => {
      active = false;
    };
  }, []);

  const value = useMemo(() => ({ ...health, refresh }), [health, refresh]);
  return <ApiHealthContext.Provider value={value}>{children}</ApiHealthContext.Provider>;
}

export function useApiHealth(): ApiHealthContextValue {
  const context = useContext(ApiHealthContext);
  if (!context) {
    throw new Error("useApiHealth precisa ser usado dentro de ApiHealthProvider.");
  }
  return context;
}

function summaryStatus(health: HealthState): CheckState["status"] {
  if (health.live.status === "checking" || health.ready.status === "checking") {
    return "checking";
  }
  return health.live.status === "available" && health.ready.status === "available"
    ? "available"
    : "error";
}

const statusLabels = {
  checking: "Verificando API",
  available: "API conectada",
  error: "API indisponível",
};

export function ApiHealthIndicator() {
  const health = useApiHealth();
  const status = summaryStatus(health);

  return (
    <div className="api-indicator">
      <span className={`status-dot status-dot--${status}`} aria-hidden="true" />
      <span className="api-indicator__label" aria-live="polite">
        {statusLabels[status]}
      </span>
      <button
        className="icon-button api-indicator__refresh"
        type="button"
        onClick={() => void health.refresh()}
        aria-label="Verificar conexão com a API novamente"
        title="Verificar conexão com a API"
      >
        <Icon name="refresh" size={17} />
      </button>
    </div>
  );
}

function CheckRow({ title, checkState }: { title: string; checkState: CheckState }) {
  return (
    <div className="health-check">
      <span className={`status-dot status-dot--${checkState.status}`} aria-hidden="true" />
      <span className="health-check__title">{title}</span>
      <span className={`health-check__status health-check__status--${checkState.status}`}>
        {checkState.status === "checking"
          ? "Verificando"
          : checkState.status === "available"
            ? "Disponível"
            : "Indisponível"}
      </span>
      {checkState.status === "error" && (
        <p className="health-check__error" role="status">{checkState.message}</p>
      )}
    </div>
  );
}

export function ApiHealthPanel() {
  const health = useApiHealth();
  const status = summaryStatus(health);

  return (
    <section className="panel api-panel" aria-labelledby="api-panel-title">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Conectividade</p>
          <h2 id="api-panel-title">Status da API</h2>
        </div>
        <span className={`status-pill status-pill--${status}`}>
          {statusLabels[status]}
        </span>
      </div>
      <p className="panel-description">
        Verificação dos endpoints de saúde disponíveis no backend.
      </p>
      <div className="health-checks">
        <CheckRow title="Liveness" checkState={health.live} />
        <CheckRow title="Readiness · banco e fila" checkState={health.ready} />
      </div>
      {health.checkedAt && (
        <p className="checked-at">
          Última verificação:{" "}
          {new Intl.DateTimeFormat("pt-BR", {
            dateStyle: "short",
            timeStyle: "short",
            timeZone: "America/Sao_Paulo",
          }).format(health.checkedAt)}
        </p>
      )}
    </section>
  );
}
