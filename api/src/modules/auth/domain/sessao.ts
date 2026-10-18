/**
 * Formatos que cruzam a fronteira API → BFF, e o mapeamento da sessão/usuário do Supabase para
 * eles. Puro.
 *
 * A API CRIA a sessão no Supabase e a DEVOLVE ao BFF (servidor a servidor); quem grava cookie
 * httpOnly no navegador é o BFF (`ecv2_at`/`ecv2_rt`). O navegador nunca vê token — hoje ele
 * guarda a sessão inteira no localStorage.
 */

/** `{ access_token, refresh_token, expires_at }` — `expires_at` em SEGUNDOS, como no Supabase. */
export type SessaoDto = { access_token: string; refresh_token: string; expires_at: number };

export type PapelAdmin = 'system_admin' | 'tech_admin';

/**
 * O `AdminUser` de hoje (`easyCONTROL/src/lib/auth-context.tsx`), campo a campo — é o que o
 * cabeçalho e a barra lateral mostram.
 */
export type AdminUser = { id: string; email: string; name: string; role: PapelAdmin };

/** O pouco da `Session` do supabase-js que a resposta usa. */
export type SessaoSupabase = {
  access_token: string;
  refresh_token: string;
  expires_at?: number;
  expires_in?: number;
};

/** Identidade do usuário: do objeto `User` no login, das claims do JWT nas outras rotas. */
export type Identidade = { id: string; email?: unknown; user_metadata?: unknown };

/**
 * `expires_at` normalmente vem preenchido; se faltar, deriva de `expires_in` (o supabase-js faz
 * a mesma conta). Arredonda para inteiro de segundos.
 */
export function paraSessaoDto(s: SessaoSupabase, agoraSeg: number): SessaoDto {
  const expiresAt =
    typeof s.expires_at === 'number' && Number.isFinite(s.expires_at)
      ? s.expires_at
      : agoraSeg + (typeof s.expires_in === 'number' ? s.expires_in : 0);
  return { access_token: s.access_token, refresh_token: s.refresh_token, expires_at: Math.floor(expiresAt) };
}

/**
 * `toAdminUser` de hoje: nome = `full_name` → `name` → parte local do e-mail → "admin".
 * O `??` é o mesmo de hoje: string VAZIA em `full_name` vence (não cai para o próximo).
 */
export function paraAdminUser(u: Identidade, role: PapelAdmin): AdminUser {
  const meta = (u.user_metadata && typeof u.user_metadata === 'object' ? u.user_metadata : {}) as Record<
    string,
    unknown
  >;
  const email = typeof u.email === 'string' ? u.email : '';
  const fullName = typeof meta.full_name === 'string' ? meta.full_name : undefined;
  const nome = typeof meta.name === 'string' ? meta.name : undefined;
  const name = fullName ?? nome ?? (email ? email.split('@')[0] : 'admin');
  return { id: u.id, email, name, role };
}

/**
 * Resultado de uma chamada ao Supabase Auth, já sem o tipo do SDK. `erro` é a mensagem ORIGINAL
 * do Supabase — hoje a tela de login a mostra crua ("Invalid login credentials").
 */
export type ResultadoAuth<T> = { ok: true; valor: T } | { ok: false; erro: string };
