import { Inject, Injectable, Optional } from '@nestjs/common';
import { createClient, type AuthError, type SupabaseClient } from '@supabase/supabase-js';
import { ENV, type Env } from '../../../config/env';
import type { Database } from '../../../db/database.types';
import { paraSessaoDto, type Identidade, type ResultadoAuth, type SessaoDto } from '../domain/sessao';

/** Token de injeção opcional: `fetch` alternativo para os testes (sem rede). */
export const FETCH_DO_AUTH = Symbol('FETCH_DO_AUTH');

export type SessaoEIdentidade = { session: SessaoDto; user: Identidade };

/**
 * As chamadas ao Supabase Auth que o `auth-context.tsx` de hoje faz NO NAVEGADOR
 * (`signInWithPassword`, `signOut`) e a renovação que o supabase-js fazia sozinho
 * (`autoRefreshToken`). Agora rodam aqui, cada uma num cliente descartável: sem sessão guardada
 * no processo — quem guarda é o BFF, em cookie httpOnly.
 *
 * Chave PUBLISHABLE, nunca a service_role.
 */
@Injectable()
export class SupabaseAuthGateway {
  constructor(
    @Inject(ENV) private readonly env: Env,
    @Optional() @Inject(FETCH_DO_AUTH) private readonly fetchFn?: typeof fetch,
  ) {}

  private cliente(): SupabaseClient<Database> {
    return createClient<Database>(this.env.SUPABASE_URL, this.env.SUPABASE_PUBLISHABLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      ...(this.fetchFn ? { global: { fetch: this.fetchFn } } : {}),
    });
  }

  async entrarComSenha(email: string, password: string): Promise<ResultadoAuth<SessaoEIdentidade | null>> {
    return capturar(async () => {
      const { data, error } = await this.cliente().auth.signInWithPassword({ email, password });
      if (error) return { ok: false, erro: error.message };
      // Hoje: `if (!data.user) throw ACCESS_DENIED` — sem usuário/sessão, `null` e o caso de uso recusa.
      if (!data.session || !data.user) return { ok: true, valor: null };
      return {
        ok: true,
        valor: {
          session: paraSessaoDto(data.session, agoraSeg()),
          user: { id: data.user.id, email: data.user.email, user_metadata: data.user.user_metadata },
        },
      };
    });
  }

  async renovar(refreshToken: string): Promise<ResultadoAuth<SessaoDto> & { retentavel?: boolean }> {
    try {
      const { data, error } = await this.cliente().auth.refreshSession({ refresh_token: refreshToken });
      if (error) return { ok: false, erro: error.message, retentavel: ehRetentavel(error) };
      if (!data.session) return { ok: false, erro: 'o Supabase não devolveu sessão' };
      return { ok: true, valor: paraSessaoDto(data.session, agoraSeg()) };
    } catch (e) {
      return { ok: false, erro: mensagemDe(e), retentavel: true };
    }
  }

  /**
   * `supabase.auth.signOut()` de hoje usa o escopo padrão do supabase-js: `global` — revoga
   * TODAS as sessões do usuário. Mesma chamada, com o JWT dele.
   */
  async encerrar(accessToken: string): Promise<ResultadoAuth<null>> {
    return capturar(async () => {
      const { error } = await this.cliente().auth.admin.signOut(accessToken);
      return error ? { ok: false, erro: error.message } : { ok: true, valor: null };
    });
  }
}

/** O SDK DEVOLVE a maioria dos erros, mas também LANÇA alguns (rede, configuração). */
async function capturar<T>(fn: () => Promise<ResultadoAuth<T>>): Promise<ResultadoAuth<T>> {
  try {
    return await fn();
  } catch (e) {
    return { ok: false, erro: mensagemDe(e) };
  }
}

/**
 * Falha de rede/serviço (5xx, `AuthRetryableFetchError`) ≠ refresh token inválido. O BFF trata
 * as duas de jeito diferente: a primeira mantém a sessão, a segunda apaga os cookies.
 */
function ehRetentavel(error: AuthError): boolean {
  if (error.name === 'AuthRetryableFetchError') return true;
  const status = (error as { status?: unknown }).status;
  return typeof status === 'number' && (status >= 500 || status === 0);
}

const mensagemDe = (e: unknown) => (e instanceof Error ? e.message : String(e));
const agoraSeg = () => Math.floor(Date.now() / 1000);
