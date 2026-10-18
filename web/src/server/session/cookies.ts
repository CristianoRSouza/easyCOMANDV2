import "server-only";

/**
 * Cookies de sessão do BFF :
 * `httpOnly`, `SameSite=Lax`, `Secure` em HTTPS, `Path=/`. O navegador nunca vê token.
 */
export const ACCESS_TOKEN_COOKIE = "ecv2_at";
export const REFRESH_TOKEN_COOKIE = "ecv2_rt";

/**
 * Vida dos dois cookies: 400 dias, o mesmo padrão do `@supabase/ssr`.
 * Quem decide se a sessão vale é a API (JWT + refresh token), não a idade do cookie: o access
 * token é renovado pelo `exp` do próprio JWT, e um refresh token revogado faz o `/auth/refresh`
 * falhar, o que apaga os dois cookies.
 */
export const SESSION_COOKIE_MAX_AGE = 400 * 24 * 60 * 60;

export interface CookieOptions {
  maxAge: number;
  secure: boolean;
  httpOnly?: boolean;
}

export function serializeCookie(name: string, value: string, options: CookieOptions): string {
  const parts = [`${name}=${value}`, "Path=/", `Max-Age=${options.maxAge}`, "SameSite=Lax"];
  if (options.httpOnly ?? true) parts.push("HttpOnly");
  if (options.secure) parts.push("Secure");
  return parts.join("; ");
}

export function readCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key !== name) continue;
    try {
      const value = decodeURIComponent(rest.join("="));
      return value || null;
    } catch {
      // Valor vindo do cliente: malformado é sessão ausente, nunca 500.
      return null;
    }
  }
  return null;
}

export interface SessionTokens {
  access_token: string;
  refresh_token: string;
  /** Segundos desde a época (formato do Supabase). */
  expires_at: number;
}

export function sessionCookies(session: SessionTokens, secure: boolean): string[] {
  return [
    serializeCookie(ACCESS_TOKEN_COOKIE, encodeURIComponent(session.access_token), {
      maxAge: SESSION_COOKIE_MAX_AGE,
      secure,
    }),
    serializeCookie(REFRESH_TOKEN_COOKIE, encodeURIComponent(session.refresh_token), {
      maxAge: SESSION_COOKIE_MAX_AGE,
      secure,
    }),
  ];
}

export function clearedSessionCookies(secure: boolean): string[] {
  return [
    serializeCookie(ACCESS_TOKEN_COOKIE, "", { maxAge: 0, secure }),
    serializeCookie(REFRESH_TOKEN_COOKIE, "", { maxAge: 0, secure }),
  ];
}

/** Valida o formato `session` que a API devolve (`{ access_token, refresh_token, expires_at }`). */
export function asSessionTokens(raw: unknown): SessionTokens | null {
  if (!raw || typeof raw !== "object") return null;
  const s = raw as Record<string, unknown>;
  if (typeof s.access_token !== "string" || !s.access_token) return null;
  if (typeof s.refresh_token !== "string" || !s.refresh_token) return null;
  if (typeof s.expires_at !== "number" || !Number.isFinite(s.expires_at)) return null;
  return { access_token: s.access_token, refresh_token: s.refresh_token, expires_at: s.expires_at };
}
