import type { BffDeps } from "@/server/api/api-client";
import type { ServerConfig } from "@/server/config";

/** Utilitários de teste do BFF: config fixa, relógio fixo e um `fetch` falso que registra chamadas. */

export const NOW = 1_800_000_000;

export const TEST_CONFIG: ServerConfig = {
  apiUrl: "http://api.test",
  secureCookies: true,
};

export interface RecordedCall {
  url: string;
  method: string;
  headers: Headers;
  body: ArrayBuffer | null;
  signal: AbortSignal | null;
}

export type Responder = (call: RecordedCall) => Response | Promise<Response>;

export function fakeFetch(responder: Responder) {
  const calls: RecordedCall[] = [];
  const fetchFn = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const raw = init?.body;
    let body: ArrayBuffer | null = null;
    if (typeof raw === "string") body = new TextEncoder().encode(raw).buffer as ArrayBuffer;
    else if (raw instanceof ArrayBuffer) body = raw;
    else if (ArrayBuffer.isView(raw)) body = new Uint8Array(raw.buffer, raw.byteOffset, raw.byteLength).slice().buffer as ArrayBuffer;
    const call: RecordedCall = {
      url: String(input),
      method: init?.method ?? "GET",
      headers: new Headers(init?.headers),
      body,
      signal: init?.signal ?? null,
    };
    calls.push(call);
    return responder(call);
  }) as typeof fetch;
  return { fetchFn, calls };
}

export function makeDeps(responder: Responder, config: Partial<ServerConfig> = {}) {
  const { fetchFn, calls } = fakeFetch(responder);
  const deps: BffDeps = { config: { ...TEST_CONFIG, ...config }, fetchFn, nowSec: () => NOW };
  return { deps, calls };
}

const b64url = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");

/** JWT de teste (assinatura falsa) que vence em `exp`. */
export function jwt(exp: number, sub = "user-1"): string {
  return `${b64url({ alg: "HS256", typ: "JWT" })}.${b64url({ sub, exp })}.sig`;
}

export function json(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });
}

export function cookieHeader(values: Record<string, string>): string {
  return Object.entries(values)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join("; ");
}

export const neverCalled: Responder = (call) => {
  throw new Error(`fetch inesperado: ${call.method} ${call.url}`);
};

export function bodyText(call: RecordedCall): string {
  return call.body ? new TextDecoder().decode(call.body) : "";
}
