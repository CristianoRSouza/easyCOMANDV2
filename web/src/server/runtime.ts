import "server-only";
import { getServerConfig } from "./config";
import type { BffDeps } from "./api/api-client";

/** Dependências reais do BFF (as rotas usam isto; os testes passam as suas). */
export function defaultDeps(): BffDeps {
  return {
    config: getServerConfig(),
    // Lido a cada chamada (não capturado): permite trocar o `fetch` global em diagnóstico.
    fetchFn: (input, init) => fetch(input, init),
    nowSec: () => Math.floor(Date.now() / 1000),
  };
}
