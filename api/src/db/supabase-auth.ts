import { Inject, Injectable } from '@nestjs/common';
import { createClient, type AuthError, type JwtPayload, type SupabaseClient } from '@supabase/supabase-js';
import { ENV, type Env } from '../config/env';
import type { Database } from './database.types';

/** Claims do JWT do Supabase já verificado (`sub` = id do usuário). */
export type JwtClaims = JwtPayload;

/** Resultado cru do `getClaims` — quem traduz para 401 (e com qual mensagem) é o AuthGuard. */
export type ResultadoClaims = { claims: JwtClaims | null; error: AuthError | null };

/**
 * Verificação do JWT de sessão — a MESMA checagem do `requireSupabaseAuth` de hoje
 * (`supabase.auth.getClaims`), só que recebendo o token do header em vez do cookie.
 *
 * `getClaims` valida a assinatura LOCALMENTE com as chaves públicas do projeto (JWKS, que o
 * cliente busca uma vez e guarda em cache) e confere o `exp`. Por isso o cliente é UM SÓ,
 * de vida longa: criar um por requisição jogaria o cache fora e buscaria o JWKS toda vez.
 * (Em projeto com segredo simétrico o próprio supabase-js cai no `getUser`, que vai ao Auth.)
 *
 * Chave publishable: verificar token não exige privilégio nenhum.
 */
@Injectable()
export class SupabaseAuthVerifier {
  private readonly client: SupabaseClient<Database>;

  constructor(@Inject(ENV) env: Env) {
    this.client = createClient<Database>(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
  }

  async verificar(accessToken: string): Promise<ResultadoClaims> {
    const { data, error } = await this.client.auth.getClaims(accessToken);
    return { claims: data?.claims ?? null, error };
  }
}
