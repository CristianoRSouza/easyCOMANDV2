import "server-only";
import type { ServerConfig } from "../config";

/** Prefixo de todas as rotas da API NestJS. */
export const API_PREFIX = "/api/v1";

/** `path` começa com `/` e NÃO inclui o prefixo `/api/v1`. */
export function apiUrl(config: ServerConfig, path: string, search = ""): string {
  return `${config.apiUrl}${API_PREFIX}${path}${search}`;
}

/** Dependências do BFF — injetáveis para os testes não dependerem de rede nem de relógio. */
export interface BffDeps {
  config: ServerConfig;
  fetchFn: typeof fetch;
  /** Agora, em segundos (como o `expires_at` do Supabase). */
  nowSec: () => number;
}

/** Envelope de erro da API (`{ error, message, statusCode }`) — o BFF usa o mesmo nos erros dele. */
export interface ApiErrorEnvelope {
  error: string;
  message: string;
  statusCode: number;
}

/** Mensagem do 401 de sessão (a mesma da API). */
export const SESSION_EXPIRED_MESSAGE = "Sessão inválida ou expirada. Faça login novamente.";

export const SESSION_EXPIRED: ApiErrorEnvelope = {
  error: "unauthorized",
  message: SESSION_EXPIRED_MESSAGE,
  statusCode: 401,
};

export const API_UNREACHABLE: ApiErrorEnvelope = {
  error: "api_unreachable",
  message: "Não foi possível contactar o servidor. Tente novamente.",
  statusCode: 503,
};

export function jsonResponse(status: number, body: unknown, setCookies: string[] = [], extra: Record<string, string> = {}): Response {
  const headers = new Headers({ "content-type": "application/json", ...extra });
  for (const cookie of setCookies) headers.append("set-cookie", cookie);
  return new Response(JSON.stringify(body), { status, headers });
}

export function parseJsonSafely(text: string): unknown {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/**
 * Contexto do navegador que a API precisa em TODA chamada do BFF:
 * - `x-forwarded-for`: IP do navegador para o rate-limit por IP (sem isso todos os usuários dividem
 *   a cota do servidor do Next). Vem do proxy da frente (`x-forwarded-for`/`x-real-ip`);
 * - `x-request-id`: correlação de log (o recebido, senão um novo).
 */
export function browserContextHeaders(request: Request): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const name of ["origin", "referer", "x-forwarded-for"] as const) {
    const value = request.headers.get(name);
    if (value) headers[name] = value;
  }
  if (!headers["x-forwarded-for"]) {
    const realIp = request.headers.get("x-real-ip");
    if (realIp) headers["x-forwarded-for"] = realIp;
  }
  headers["x-request-id"] = request.headers.get("x-request-id") || crypto.randomUUID();
  return headers;
}

/** Chamada JSON servidor-a-servidor. `null` quando a API não respondeu (rede/DNS/recusa). */
export async function callApiJson(
  deps: BffDeps,
  init: {
    method: "GET" | "POST";
    path: string;
    search?: string;
    body?: unknown;
    token?: string | null;
    /** Cabeçalhos extras (ex.: `origin`/`referer` do navegador, para a API montar URLs de retorno). */
    headers?: Record<string, string>;
  },
): Promise<{ status: number; body: unknown } | null> {
  const headers = new Headers({ ...init.headers, accept: "application/json" });
  if (init.body !== undefined) headers.set("content-type", "application/json");
  if (init.token) headers.set("authorization", `Bearer ${init.token}`);
  try {
    const response = await deps.fetchFn(apiUrl(deps.config, init.path, init.search), {
      method: init.method,
      headers,
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      cache: "no-store",
      redirect: "manual",
    });
    return { status: response.status, body: parseJsonSafely(await response.text()) };
  } catch {
    return null;
  }
}
