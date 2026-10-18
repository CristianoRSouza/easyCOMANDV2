import "server-only";
import { API_UNREACHABLE, SESSION_EXPIRED, apiUrl, browserContextHeaders, jsonResponse, type BffDeps } from "../api/api-client";
import { clearedSessionCookies } from "../session/cookies";
import { resolveSession } from "../session/session-resolver";

/** Cabeçalhos do navegador que seguem para a API. A autenticação é posta pelo BFF. */
export const FORWARDED_REQUEST_HEADERS = [
  "accept",
  "content-type",
  "accept-language",
  "if-none-match",
  "x-request-id",
] as const;

/** Cabeçalhos da API que voltam ao navegador (downloads e cache incluídos). Nunca `set-cookie`. */
export const FORWARDED_RESPONSE_HEADERS = [
  "content-type",
  "content-disposition",
  "content-language",
  "cache-control",
  "etag",
  "last-modified",
  "retry-after",
  "location",
] as const;

const INVALID_SEGMENTS = new Set(["", ".", ".."]);
const INVALID_PATH = { error: "invalid_path", message: "Caminho inválido.", statusCode: 400 };
const NO_BODY_STATUSES = new Set([101, 204, 205, 304]);

function pick(source: Headers, names: readonly string[]): Headers {
  const picked = new Headers();
  for (const name of names) {
    const value = source.get(name);
    if (value !== null) picked.set(name, value);
  }
  return picked;
}

/**
 * Repasse autenticado `/api/v1/<path>` → `${EASYCONTROL_API_URL}/api/v1/<path>`.
 *
 * Preserva método, query, corpo (bytes), status e os cabeçalhos relevantes. O token sai do cookie
 * `ecv2_at` (renovado antes, se preciso) e vai como `Authorization: Bearer`. 401 da API apaga os
 * cookies de sessão: a tela volta ao login.
 */
export async function handleApiForward(request: Request, segments: string[], deps: BffDeps): Promise<Response> {
  if (segments.length === 0 || segments.some((s) => INVALID_SEGMENTS.has(s))) {
    return jsonResponse(400, INVALID_PATH);
  }

  const context = browserContextHeaders(request);
  const resolved = await resolveSession(request.headers.get("cookie"), deps, context);
  if (resolved.kind === "anonymous") return jsonResponse(401, SESSION_EXPIRED);
  if (resolved.kind === "expired") return jsonResponse(401, SESSION_EXPIRED, resolved.setCookies);
  if (resolved.kind === "unreachable") return jsonResponse(503, API_UNREACHABLE);

  const headers = pick(request.headers, FORWARDED_REQUEST_HEADERS);
  for (const [name, value] of Object.entries(context)) headers.set(name, value);
  headers.set("authorization", `Bearer ${resolved.accessToken}`);

  const method = request.method.toUpperCase();
  const hasBody = method !== "GET" && method !== "HEAD";
  const search = new URL(request.url).search;
  const path = `/${segments.map(encodeURIComponent).join("/")}`;

  let backend: Response;
  try {
    backend = await deps.fetchFn(apiUrl(deps.config, path, search), {
      method,
      headers,
      body: hasBody ? await request.arrayBuffer() : undefined,
      cache: "no-store",
      redirect: "manual",
    });
  } catch {
    return jsonResponse(503, API_UNREACHABLE, resolved.setCookies);
  }

  const responseHeaders = pick(backend.headers, FORWARDED_RESPONSE_HEADERS);
  const setCookies =
    backend.status === 401 ? clearedSessionCookies(deps.config.secureCookies) : resolved.setCookies;
  for (const cookie of setCookies) responseHeaders.append("set-cookie", cookie);

  const body = NO_BODY_STATUSES.has(backend.status) || method === "HEAD" ? null : backend.body;
  return new Response(body, { status: backend.status, statusText: backend.statusText, headers: responseHeaders });
}
