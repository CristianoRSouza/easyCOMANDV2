import { ApiError } from "./api-error";
import { notifySessionExpired } from "./session-events";

/**
 * Cliente HTTP do NAVEGADOR. Só conhece o próprio Next: `/api/v1/*` é repassado à API com o token
 * do cookie httpOnly (o navegador nunca vê token). Use dentro de `modules/<x>/infrastructure`.
 *
 * Erros viram `ApiError` com o `message` do envelope — o MESMO texto que a tela de hoje mostra
 * (o `throw new Error("…")` das server functions chegava à tela pelo `message`).
 */

export interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  signal?: AbortSignal;
}

export const API_BASE = "/api/v1";

/**
 * Mensagem de QUALQUER 429 (inclusive o do limitador global da API, que vem em inglês) — o mesmo
 * texto padrão de excesso de tentativas.
 */
export const TOO_MANY_ATTEMPTS_MESSAGE = "Muitas tentativas. Aguarde alguns instantes e tente de novo.";

/** Mensagem quando nem o Next respondeu (rede caída). */
export const NETWORK_ERROR_MESSAGE = "Não foi possível contactar o servidor.";

export async function readBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/** Monta a URL com query, ignorando valores `undefined`/`null`. */
export function withQuery(path: string, query: Record<string, string | number | boolean | null | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null) params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

export async function request(path: string, options: RequestOptions = {}, base = API_BASE): Promise<Response> {
  const headers = new Headers({ accept: "application/json" });
  if (options.body !== undefined) headers.set("content-type", "application/json");
  try {
    return await fetch(`${base}${path}`, {
      method: options.method ?? "GET",
      headers,
      credentials: "same-origin",
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: options.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new ApiError(0, "network", NETWORK_ERROR_MESSAGE);
  }
}

/** Corpo do sucesso, ou `ApiError` com a mensagem da API (`message`, senão `error`). */
export async function toResult<T>(response: Response): Promise<T> {
  if (response.status === 204) return undefined as T;
  const body = await readBody(response);
  if (!response.ok) {
    if (response.status === 401) notifySessionExpired();
    const envelope = (body && typeof body === "object" ? body : {}) as { error?: unknown; message?: unknown };
    const code = typeof envelope.error === "string" ? envelope.error : `http_${response.status}`;
    const message =
      response.status === 429
        ? TOO_MANY_ATTEMPTS_MESSAGE
        : typeof envelope.message === "string" && envelope.message
        ? envelope.message
        : typeof envelope.error === "string" && envelope.error
          ? envelope.error
          : `Falha na requisição (HTTP ${response.status}).`;
    throw new ApiError(response.status, code, message, body);
  }
  return body as T;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  return toResult<T>(await request(path, options));
}
