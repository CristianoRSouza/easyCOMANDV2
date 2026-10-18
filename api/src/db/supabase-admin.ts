import { Inject, Injectable } from '@nestjs/common';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { ENV, type Env } from '../config/env';
import type { Database } from './database.types';

/** Cliente com a service_role: IGNORA a RLS. O tipo tem nome próprio para ser grepável. */
export type SupabaseAdminClient = SupabaseClient<Database>;

/**
 * Cliente Supabase com a chave service_role — o equivalente ao `supabaseAdmin` de
 * `easyCONTROL/src/integrations/supabase/client.server.ts`, com as mesmas opções de auth
 * (sem sessão persistida, sem refresh: é um cliente de servidor, não um usuário).
 *
 * ⚠️ NÃO injete esta classe em módulo de negócio. A porta é o `ServiceRole`, que exige um
 * motivo para cada uso (ver service-role.ts). O ESLint barra o import fora da camada
 * `infrastructure`, e a regra de revisão é: todo `supabaseAdmin` de hoje vira um
 * `serviceRole.run('<motivo>', …)`, nenhum vira injeção direta.
 */
@Injectable()
export class SupabaseAdmin {
  readonly client: SupabaseAdminClient;

  constructor(@Inject(ENV) env: Env) {
    this.client = createClient<Database>(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
  }
}
