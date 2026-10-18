import { Inject, Injectable } from '@nestjs/common';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { ENV, type Env } from '../config/env';
import type { Database } from './database.types';

/** Cliente que fala com o Supabase COMO o usuário: toda consulta passa pela RLS. */
export type UserSupabaseClient = SupabaseClient<Database>;

/**
 * Monta o cliente do usuário a partir do JWT da requisição.
 *
 * Hoje o EasyControl cria o cliente com o Bearer que o navegador anexa; aqui não há
 * cookie (quem tem o cookie é o BFF do Next), há o `Authorization: Bearer <access_token>` que
 * o BFF repassa. O efeito no banco é o MESMO: o PostgREST recebe o JWT do usuário, `auth.uid()`
 * resolve para ele e as policies de RLS decidem o que ele vê — sem nenhuma mudança no banco.
 *
 * Por que `global.headers.Authorization` e não `auth.setSession`: o cliente é descartável
 * (um por requisição) e não precisa de refresh — quem renova o token é o BFF. `setSession`
 * exigiria o refresh_token, que a API nem recebe nas rotas de dado.
 *
 * Chave = publishable (a "anon"), NUNCA a service_role: é ela que faz a RLS valer.
 */
export function criarClienteDoUsuario(
  env: Pick<Env, 'SUPABASE_URL' | 'SUPABASE_PUBLISHABLE_KEY'>,
  accessToken: string,
): UserSupabaseClient {
  return createClient<Database>(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

/** A mesma fábrica, injetável — é o que o `AuthGuard` usa para preparar o `@UserSupabase()`. */
@Injectable()
export class UserSupabaseFactory {
  constructor(@Inject(ENV) private readonly env: Env) {}

  paraToken(accessToken: string): UserSupabaseClient {
    return criarClienteDoUsuario(this.env, accessToken);
  }
}
