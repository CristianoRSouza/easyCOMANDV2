import "server-only";
import {
  API_UNREACHABLE,
  SESSION_EXPIRED,
  browserContextHeaders,
  callApiJson,
  jsonResponse,
  type BffDeps,
} from "../api/api-client";
import { asSessionTokens, clearedSessionCookies, sessionCookies } from "../session/cookies";
import { resolveSession } from "../session/session-resolver";

/**
 * Rotas de sessão do navegador (`/api/session/*`). Chamam a API servidor-a-servidor conforme o
 * contrato de docs/arquitetura.md:
 *
 * | BFF                         | API (prefixo /api/v1)              |
 * |-----------------------------|------------------------------------|
 * | POST /api/session/login     | POST /auth/login  → { session, user } |
 * | POST /api/session/logout    | POST /auth/logout (Bearer) → 204   |
 * | GET  /api/session           | GET  /auth/me     (Bearer) → { user } |
 *
 * Erros da API voltam ao navegador com o MESMO status e corpo (`{ error, message, statusCode }`),
 * para a tela mostrar a mesma mensagem de hoje.
 */

const INVALID_BODY = { error: "invalid_body", message: "Requisição inválida.", statusCode: 400 };
const INVALID_SESSION = {
  error: "invalid_session",
  message: "A API devolveu uma sessão inválida.",
  statusCode: 502,
};

export async function handleLogin(request: Request, deps: BffDeps): Promise<Response> {
  const raw: unknown = await request.json().catch(() => null);
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return jsonResponse(400, INVALID_BODY);
  const { email, password } = raw as Record<string, unknown>;

  const result = await callApiJson(deps, {
    method: "POST",
    path: "/auth/login",
    body: { email, password },
    headers: browserContextHeaders(request),
  });
  if (!result) return jsonResponse(503, API_UNREACHABLE);
  if (result.status !== 200) return jsonResponse(result.status, result.body ?? {});

  const body = (result.body ?? {}) as { session?: unknown; user?: unknown };
  const session = asSessionTokens(body.session);
  if (!session) return jsonResponse(502, INVALID_SESSION);
  return jsonResponse(200, { user: body.user ?? null }, sessionCookies(session, deps.config.secureCookies));
}

export async function handleGetSession(request: Request, deps: BffDeps): Promise<Response> {
  const context = browserContextHeaders(request);
  const resolved = await resolveSession(request.headers.get("cookie"), deps, context);
  if (resolved.kind === "anonymous") return jsonResponse(401, SESSION_EXPIRED);
  if (resolved.kind === "expired") return jsonResponse(401, SESSION_EXPIRED, resolved.setCookies);
  if (resolved.kind === "unreachable") return jsonResponse(503, API_UNREACHABLE);

  const result = await callApiJson(deps, { method: "GET", path: "/auth/me", token: resolved.accessToken, headers: context });
  if (!result) return jsonResponse(503, API_UNREACHABLE, resolved.setCookies);
  // 401: a sessão caiu. 403: deixou de ser admin — a API já encerrou a sessão no Supabase; os
  // cookies saem junto, para o próximo acesso não tentar renovar um refresh token revogado.
  if (result.status === 401 || result.status === 403) {
    return jsonResponse(result.status, result.body ?? SESSION_EXPIRED, clearedSessionCookies(deps.config.secureCookies));
  }
  if (result.status !== 200) return jsonResponse(result.status, result.body ?? {}, resolved.setCookies);
  const user = (result.body as { user?: unknown } | null)?.user ?? null;
  return jsonResponse(200, { user }, resolved.setCookies);
}

/**
 * Encerra a sessão na API (revoga o refresh token no Supabase) e apaga os cookies. Os cookies são
 * apagados SEMPRE — mesmo com a API fora do ar, o navegador sai.
 */
export async function handleLogout(request: Request, deps: BffDeps): Promise<Response> {
  const context = browserContextHeaders(request);
  const resolved = await resolveSession(request.headers.get("cookie"), deps, context);
  if (resolved.kind === "active") {
    await callApiJson(deps, { method: "POST", path: "/auth/logout", token: resolved.accessToken, headers: context });
  }
  const headers = new Headers();
  for (const cookie of clearedSessionCookies(deps.config.secureCookies)) headers.append("set-cookie", cookie);
  return new Response(null, { status: 204, headers });
}
