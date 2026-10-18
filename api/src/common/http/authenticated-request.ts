import type { Request } from 'express';
import type { JwtClaims } from '../../db/supabase-auth';
import type { UserSupabaseClient } from '../../db/user-supabase';

/**
 * A requisição DEPOIS do `AuthGuard` — o que ele deixa escrito nela.
 *
 * Quase nenhum controller precisa deste tipo: os decorators de `request.decorators.ts`
 * entregam cada valor já pronto.
 */
export type UsuarioAutenticado = {
  /** `sub` do JWT — o id do usuário no Supabase Auth. */
  id: string;
  /** Claims completas, já verificadas (email, role, aal, session_id…). */
  claims: JwtClaims;
};

export type AuthenticatedRequest = Request & {
  user: UsuarioAutenticado;
  /** O JWT cru, exatamente como chegou — para a fábrica do cliente do usuário. */
  accessToken: string;
  /**
   * Cliente Supabase do usuário (RLS), criado na PRIMEIRA chamada e reaproveitado no resto da
   * requisição. Preguiçoso porque rota que não consulta nada não precisa pagar a criação.
   */
  supabaseDoUsuario: () => UserSupabaseClient;
};
