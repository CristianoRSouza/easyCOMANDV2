import { Injectable } from '@nestjs/common';
import type { UserSupabaseClient } from '../../db/user-supabase';
import type { AtribuicaoComPapel, OverrideDePermissao } from './regras';

/**
 * Leituras de papel/permissão do PRÓPRIO usuário, com o cliente dele (RLS) — exatamente as
 * consultas que as server functions de hoje fazem antes de cada ação.
 *
 * Erros de leitura viram lista vazia, como hoje (`(data ?? [])`): na dúvida, o usuário NÃO é
 * admin e a ação é recusada.
 */
@Injectable()
export class PapeisRepository {
  async papeisLegados(db: UserSupabaseClient, userId: string): Promise<string[]> {
    const { data } = await db.from('pv_user_roles').select('role').eq('user_id', userId);
    return ((data ?? []) as { role: string }[]).map((r) => r.role);
  }

  /** `company_id` filtra quando informado (o `isCompanyAdmin` de hoje). */
  async atribuicoes(db: UserSupabaseClient, userId: string, companyId?: string): Promise<AtribuicaoComPapel[]> {
    let q = db.from('pv_user_role_assignments').select('company_id, pv_roles!inner(key)').eq('user_id', userId);
    if (companyId) q = q.eq('company_id', companyId);
    const { data } = await q;
    return ((data ?? []) as unknown as Array<{ company_id: string | null; pv_roles: { key: string } | null }>).map(
      (r) => ({ company_id: r.company_id, role_key: r.pv_roles?.key ?? null }),
    );
  }

  async overridesDiretos(db: UserSupabaseClient, userId: string): Promise<OverrideDePermissao[]> {
    const { data } = await db
      .from('pv_user_permissions')
      .select('effect, pv_permissions!inner(key)')
      .eq('user_id', userId);
    return ((data ?? []) as unknown as Array<{ effect: string; pv_permissions: { key: string } | null }>).map((r) => ({
      effect: r.effect,
      permission_key: r.pv_permissions?.key ?? null,
    }));
  }

  async idsDasRoles(db: UserSupabaseClient, userId: string): Promise<string[]> {
    const { data } = await db.from('pv_user_role_assignments').select('role_id').eq('user_id', userId);
    return ((data ?? []) as { role_id: string }[]).map((r) => r.role_id);
  }

  async chavesDasPermissoesDasRoles(db: UserSupabaseClient, roleIds: string[]): Promise<string[]> {
    const { data } = await db.from('pv_role_permissions').select('pv_permissions!inner(key)').in('role_id', roleIds);
    return ((data ?? []) as unknown as Array<{ pv_permissions: { key: string } | null }>)
      .map((r) => r.pv_permissions?.key)
      .filter((k): k is string => !!k);
  }
}
