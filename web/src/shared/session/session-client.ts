import { ApiError } from "@/shared/http/api-error";
import { readBody, toResult } from "@/shared/http/api-client";

/** O administrador da sessão — o `AdminUser` de hoje (`easyCONTROL/src/lib/auth-context.tsx`). */
export type AdminRole = "system_admin" | "tech_admin";

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: AdminRole;
}

/**
 * Chamadas de sessão ao BFF (`/api/session/*`). O token nunca chega aqui: o BFF o guarda em cookie
 * httpOnly e devolve só o usuário.
 */

export async function entrar(email: string, password: string): Promise<AdminUser> {
  const res = await fetch("/api/session/login", {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ email, password }),
  });
  const body = await toResult<{ user: AdminUser }>(res);
  return body.user;
}

export async function sair(): Promise<void> {
  await fetch("/api/session/logout", { method: "POST", credentials: "same-origin" }).catch(() => undefined);
}

/**
 * Revalida a sessão (o `verify` de hoje):
 *   • `{ estado: "admin" }`      — segue logado;
 *   • `{ estado: "fora" }`       — sem sessão ou não é mais admin (o BFF/API já encerraram);
 *   • `{ estado: "incerto" }`    — falha transitória: a tela mantém o usuário que já tinha.
 */
export type Revalidacao = { estado: "admin"; user: AdminUser } | { estado: "fora" } | { estado: "incerto" };

export async function revalidar(): Promise<Revalidacao> {
  let res: Response;
  try {
    res = await fetch("/api/session", { headers: { accept: "application/json" }, credentials: "same-origin", cache: "no-store" });
  } catch {
    return { estado: "incerto" };
  }
  if (res.status === 401 || res.status === 403) return { estado: "fora" };
  if (!res.ok) return { estado: "incerto" };
  const body = (await readBody(res)) as { user?: AdminUser | null } | null;
  return body?.user ? { estado: "admin", user: body.user } : { estado: "fora" };
}

export { ApiError };
