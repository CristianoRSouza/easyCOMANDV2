import "server-only";
import { callApiJson, type BffDeps } from "../api/api-client";
import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  asSessionTokens,
  clearedSessionCookies,
  readCookie,
  sessionCookies,
} from "./cookies";
import { readJwtExp } from "./jwt-exp";

/** Renova quando faltar MENOS que isto para o access token expirar (docs/arquitetura.md). */
export const REFRESH_MARGIN_SECONDS = 60;

export type ResolvedSession =
  /** Nenhum cookie de sessão: visitante anônimo. */
  | { kind: "anonymous" }
  /** Havia sessão, mas ela não vale mais (refresh recusado/ausente): apagar os cookies. */
  | { kind: "expired"; setCookies: string[] }
  /** A API não respondeu à renovação e o token atual já venceu: erro transitório, cookies ficam. */
  | { kind: "unreachable" }
  /** Token pronto para o `Authorization: Bearer`. `setCookies` traz os cookies novos se renovou. */
  | { kind: "active"; accessToken: string; setCookies: string[] };

/**
 * Lê a sessão dos cookies e, se o access token estiver a menos de {@link REFRESH_MARGIN_SECONDS}
 * de expirar (ou ilegível/ausente), renova com `POST /auth/refresh`.
 *
 * Requisições paralelas podem renovar ao mesmo tempo com o mesmo refresh token; o Supabase aceita
 * a reutilização dentro do intervalo de reuso (10 s por padrão) e devolve a mesma sessão.
 */
export async function resolveSession(
  cookieHeader: string | null,
  deps: BffDeps,
  /** Contexto do navegador repassado ao `/auth/refresh` (`browserContextHeaders`). */
  headers?: Record<string, string>,
): Promise<ResolvedSession> {
  const accessToken = readCookie(cookieHeader, ACCESS_TOKEN_COOKIE);
  const refreshToken = readCookie(cookieHeader, REFRESH_TOKEN_COOKIE);
  if (!accessToken && !refreshToken) return { kind: "anonymous" };

  const now = deps.nowSec();
  const exp = accessToken ? readJwtExp(accessToken) : null;
  const stillValid = accessToken !== null && exp !== null && exp > now;

  if (accessToken && stillValid && exp - now >= REFRESH_MARGIN_SECONDS) {
    return { kind: "active", accessToken, setCookies: [] };
  }

  const secure = deps.config.secureCookies;
  if (!refreshToken) {
    return stillValid
      ? { kind: "active", accessToken: accessToken!, setCookies: [] }
      : { kind: "expired", setCookies: clearedSessionCookies(secure) };
  }

  const result = await callApiJson(deps, {
    method: "POST",
    path: "/auth/refresh",
    body: { refresh_token: refreshToken },
    headers,
  });

  if (!result || result.status >= 500 || result.status === 429) {
    // Falha transitória: segue com o token atual enquanto ele ainda vale.
    return stillValid ? { kind: "active", accessToken: accessToken!, setCookies: [] } : { kind: "unreachable" };
  }

  const session =
    result.status === 200 && result.body && typeof result.body === "object"
      ? asSessionTokens((result.body as { session?: unknown }).session)
      : null;
  if (!session) return { kind: "expired", setCookies: clearedSessionCookies(secure) };

  return { kind: "active", accessToken: session.access_token, setCookies: sessionCookies(session, secure) };
}
