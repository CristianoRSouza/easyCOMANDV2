import { Injectable } from '@nestjs/common';
import { UserSupabaseFactory, type UserSupabaseClient } from '../../../db/user-supabase';
import type { PapelAdmin } from '../domain/sessao';

/**
 * `resolveAdminRole` de hoje (`easyCONTROL/src/lib/auth-context.tsx`), com o cliente do PRÓPRIO
 * usuário (RLS), lendo `pv_user_roles` filtrado pelo id dele (a RLS deixa um admin ver as linhas
 * dos outros — sem o filtro, o papel de outra pessoa decidiria a entrada):
 *
 *   • `'system_admin' | 'tech_admin'` — é admin (system vence tech);
 *   • `false` — definitivamente NÃO é admin (quem chama encerra a sessão);
 *   • `null`  — erro transitório na leitura (quem chama decide: no login recusa; na
 *               revalidação mantém o usuário, como hoje).
 *
 * Só o RBAC LEGADO abre o Control Center — uma atribuição `system_admin` do RBAC novo não basta
 * para ENTRAR, embora libere telas depois. Igual a hoje.
 */
@Injectable()
export class PapelAdminReader {
  constructor(private readonly usuarios: UserSupabaseFactory) {}

  async doToken(accessToken: string, userId: string): Promise<PapelAdmin | false | null> {
    return this.doCliente(this.usuarios.paraToken(accessToken), userId);
  }

  async doCliente(db: UserSupabaseClient, userId: string): Promise<PapelAdmin | false | null> {
    const { data, error } = await db.from('pv_user_roles').select('role').eq('user_id', userId);
    if (error) return null;
    const papeis = ((data ?? []) as { role: string }[]).map((r) => r.role);
    if (papeis.includes('system_admin')) return 'system_admin';
    if (papeis.includes('tech_admin')) return 'tech_admin';
    return false;
  }
}
