import { Injectable } from '@nestjs/common';
import { falhaDoBanco, invalido } from '../../../common/erros';
import type { UserSupabaseClient } from '../../../db/user-supabase';
import {
  msgModuloDuplicado,
  type RbacAuditEntry,
  type RbacModule,
  type RbacPermission,
  type RbacRole,
  type RbacScope,
} from '../domain/rbac';

type Db = UserSupabaseClient;
type Linha = Record<string, unknown>;

/**
 * Todas as consultas do RBAC, as MESMAS de `rbac.functions.ts`, com o cliente do usuário (RLS).
 * Onde hoje um erro é ignorado (`(data ?? [])` sem olhar `error`), aqui também — está anotado.
 */
@Injectable()
export class RbacRepository {
  // ── módulos ──────────────────────────────────────────────────────────────

  async modulos(db: Db): Promise<RbacModule[]> {
    const { data, error } = await db.from('pv_modules').select('id,key,name,description,version,is_active').order('name');
    if (error) throw falhaDoBanco(error);
    return (data ?? []) as RbacModule[];
  }

  /** Erro ignorado, como hoje: a contagem sai zerada. */
  async moduloDeCadaPermissao(db: Db): Promise<Array<string | null>> {
    const { data } = await db.from('pv_permissions').select('module_key');
    return ((data ?? []) as { module_key: string | null }[]).map((p) => p.module_key);
  }

  async salvarModulo(db: Db, id: string | undefined, linha: Linha, key: string): Promise<Linha> {
    const q = id
      ? db.from('pv_modules').update(linha as never).eq('id', id).select().single()
      : db.from('pv_modules').insert(linha as never).select().single();
    const { data, error } = await q;
    if (error) {
      if (error.code === '23505') throw invalido(msgModuloDuplicado(key));
      throw falhaDoBanco(error);
    }
    return data as Linha;
  }

  // ── permissões ───────────────────────────────────────────────────────────

  async permissoes(db: Db): Promise<RbacPermission[]> {
    const { data, error } = await db
      .from('pv_permissions')
      .select('id,key,module_key,scope,description,is_active')
      .order('module_key')
      .order('key');
    if (error) throw falhaDoBanco(error);
    return (data ?? []) as RbacPermission[];
  }

  /** Erro ignorado, como hoje. */
  async permissaoDeCadaVinculo(db: Db): Promise<string[]> {
    const { data } = await db.from('pv_role_permissions').select('permission_id');
    return ((data ?? []) as { permission_id: string }[]).map((r) => r.permission_id);
  }

  async salvarPermissao(db: Db, id: string | undefined, linha: Linha): Promise<Linha> {
    const q = id
      ? db.from('pv_permissions').update(linha as never).eq('id', id).select().single()
      : db.from('pv_permissions').insert(linha as never).select().single();
    const { data, error } = await q;
    if (error) throw falhaDoBanco(error);
    return data as Linha;
  }

  async vinculosDaPermissao(db: Db, permissionId: string): Promise<number> {
    const { data } = await db.from('pv_role_permissions').select('role_id').eq('permission_id', permissionId).limit(1);
    return (data ?? []).length;
  }

  async excluirPermissao(db: Db, id: string): Promise<void> {
    const { error } = await db.from('pv_permissions').delete().eq('id', id);
    if (error) throw falhaDoBanco(error);
  }

  // ── roles ────────────────────────────────────────────────────────────────

  async roles(db: Db): Promise<Array<Omit<RbacRole, 'permission_ids' | 'permission_keys'>>> {
    const { data, error } = await db
      .from('pv_roles')
      .select('id,key,name,description,scope,is_system')
      .order('is_system', { ascending: false })
      .order('name');
    if (error) throw falhaDoBanco(error);
    return (data ?? []) as Array<Omit<RbacRole, 'permission_ids' | 'permission_keys'>>;
  }

  /** Erro ignorado, como hoje. */
  async vinculosRolePermissao(db: Db): Promise<Array<{ role_id: string; permission_id: string; key: string }>> {
    const { data } = await db.from('pv_role_permissions').select('role_id,permission_id,pv_permissions!inner(key)');
    return ((data ?? []) as unknown as Array<{ role_id: string; permission_id: string; pv_permissions: { key: string } }>).map(
      (r) => ({ role_id: r.role_id, permission_id: r.permission_id, key: r.pv_permissions.key }),
    );
  }

  /** `.single()` sem olhar o erro, como hoje: não achou → `null`. */
  async role(db: Db, id: string): Promise<{ id: string; key: string; name: string; is_system: boolean; description: string | null; scope: RbacScope } | null> {
    const { data } = await db.from('pv_roles').select('id,key,name,is_system,description,scope').eq('id', id).single();
    return data as { id: string; key: string; name: string; is_system: boolean; description: string | null; scope: RbacScope } | null;
  }

  async atualizarRole(db: Db, id: string, linha: Linha): Promise<void> {
    const { error } = await db.from('pv_roles').update(linha as never).eq('id', id);
    if (error) throw falhaDoBanco(error);
  }

  async criarRole(db: Db, linha: Linha): Promise<Linha> {
    const { data, error } = await db.from('pv_roles').insert(linha as never).select().single();
    if (error) throw falhaDoBanco(error);
    return data as Linha;
  }

  /** Erro ignorado, como hoje (o `upsert_role` não confere o delete). */
  async limparPermissoesDaRole(db: Db, roleId: string): Promise<void> {
    await db.from('pv_role_permissions').delete().eq('role_id', roleId);
  }

  /** `conferir`: a edição confere o erro; a criação e a duplicação de hoje não. */
  async ligarPermissoes(db: Db, roleId: string, permissionIds: string[], conferir: boolean): Promise<void> {
    if (permissionIds.length === 0) return;
    const linhas = permissionIds.map((pid) => ({ role_id: roleId, permission_id: pid }));
    const { error } = await db.from('pv_role_permissions').insert(linhas as never);
    if (conferir && error) throw falhaDoBanco(error);
  }

  async permissoesDaRole(db: Db, roleId: string): Promise<string[]> {
    const { data } = await db.from('pv_role_permissions').select('permission_id').eq('role_id', roleId);
    return ((data ?? []) as { permission_id: string }[]).map((r) => r.permission_id);
  }

  async excluirRole(db: Db, id: string): Promise<void> {
    const { error } = await db.from('pv_roles').delete().eq('id', id);
    if (error) throw falhaDoBanco(error);
  }

  // ── atribuições ──────────────────────────────────────────────────────────

  async atribuicoes(db: Db, f: { user_id?: string; company_id?: string }): Promise<
    Array<{
      id: string;
      user_id: string;
      role_id: string;
      company_id: string | null;
      store_id: string | null;
      created_at: string;
      pv_roles: { id: string; key: string; name: string; scope: RbacScope };
    }>
  > {
    let q = db
      .from('pv_user_role_assignments')
      .select('id,user_id,role_id,company_id,store_id,created_at,pv_roles!inner(id,key,name,scope)')
      .order('created_at', { ascending: false })
      .limit(500);
    if (f.user_id) q = q.eq('user_id', f.user_id);
    if (f.company_id) q = q.eq('company_id', f.company_id);
    const { data, error } = await q;
    if (error) throw falhaDoBanco(error);
    return (data ?? []) as unknown as Awaited<ReturnType<RbacRepository['atribuicoes']>>;
  }

  /** Os três lookups de nomes ignoram erro, como hoje. */
  async perfis(db: Db, ids: string[]): Promise<Array<{ id: string; email: string | null; full_name: string | null }>> {
    if (!ids.length) return [];
    const { data } = await db.from('pb_profiles').select('id,email,full_name').in('id', ids);
    return (data ?? []) as Array<{ id: string; email: string | null; full_name: string | null }>;
  }

  async empresas(db: Db, ids: string[]): Promise<Array<{ id: string; name: string | null }>> {
    if (!ids.length) return [];
    const { data } = await db.from('pv_companies').select('id,name').in('id', ids);
    return (data ?? []) as Array<{ id: string; name: string | null }>;
  }

  async lojas(db: Db, ids: string[]): Promise<Array<{ id: string; trade_name: string | null }>> {
    if (!ids.length) return [];
    const { data } = await db.from('pv_stores').select('id,trade_name').in('id', ids);
    return (data ?? []) as Array<{ id: string; trade_name: string | null }>;
  }

  async roleParaAtribuir(db: Db, id: string): Promise<{ scope: RbacScope; key: string } | null> {
    const { data } = await db.from('pv_roles').select('scope,key').eq('id', id).single();
    return data as { scope: RbacScope; key: string } | null;
  }

  async criarAtribuicao(db: Db, linha: Linha): Promise<Linha> {
    const { data, error } = await db.from('pv_user_role_assignments').insert(linha as never).select().single();
    if (error) throw falhaDoBanco(error);
    return data as Linha;
  }

  async atribuicao(db: Db, id: string): Promise<{ id: string; company_id: string | null; pv_roles: { scope: string; key: string } } | null> {
    const { data } = await db
      .from('pv_user_role_assignments')
      .select('id,company_id,pv_roles!inner(scope,key)')
      .eq('id', id)
      .single();
    return data as unknown as { id: string; company_id: string | null; pv_roles: { scope: string; key: string } } | null;
  }

  async excluirAtribuicao(db: Db, id: string): Promise<void> {
    const { error } = await db.from('pv_user_role_assignments').delete().eq('id', id);
    if (error) throw falhaDoBanco(error);
  }

  // ── pessoas, empresas e lojas para os seletores ──────────────────────────

  async buscarUsuarios(db: Db, filtro: string | null): Promise<unknown[]> {
    let q = db.from('pb_profiles').select('id,email,full_name').order('full_name', { ascending: true }).limit(50);
    if (filtro) q = q.or(filtro);
    const { data, error } = await q;
    if (error) throw falhaDoBanco(error);
    return data ?? [];
  }

  async todasAsEmpresas(db: Db): Promise<Array<{ id: string; name: string | null }>> {
    const { data, error } = await db.from('pv_companies').select('id,name').order('name');
    if (error) throw falhaDoBanco(error);
    return (data ?? []) as Array<{ id: string; name: string | null }>;
  }

  async lojasDaEmpresa(db: Db, companyId?: string): Promise<unknown[]> {
    let q = db.from('pv_stores').select('id,trade_name,company_id').order('trade_name').limit(500);
    if (companyId) q = q.eq('company_id', companyId);
    const { data, error } = await q;
    if (error) throw falhaDoBanco(error);
    return data ?? [];
  }

  // ── overrides ────────────────────────────────────────────────────────────

  async overrides(db: Db, userId: string, companyId?: string): Promise<
    Array<{
      id: string;
      user_id: string;
      permission_id: string;
      company_id: string | null;
      store_id: string | null;
      effect: 'grant' | 'deny';
      pv_permissions: { id: string; key: string; scope: RbacScope };
    }>
  > {
    let q = db
      .from('pv_user_permissions')
      .select('id,user_id,permission_id,company_id,store_id,effect,pv_permissions!inner(id,key,scope)')
      .eq('user_id', userId);
    if (companyId) q = q.eq('company_id', companyId);
    const { data, error } = await q;
    if (error) throw falhaDoBanco(error);
    return (data ?? []) as unknown as Awaited<ReturnType<RbacRepository['overrides']>>;
  }

  async criarOverride(db: Db, linha: Linha): Promise<Linha> {
    const { data, error } = await db.from('pv_user_permissions').insert(linha as never).select().single();
    if (error) throw falhaDoBanco(error);
    return data as Linha;
  }

  async override(db: Db, id: string): Promise<{ id: string; company_id: string | null } | null> {
    const { data } = await db.from('pv_user_permissions').select('id,company_id').eq('id', id).single();
    return data as { id: string; company_id: string | null } | null;
  }

  async excluirOverride(db: Db, id: string): Promise<void> {
    const { error } = await db.from('pv_user_permissions').delete().eq('id', id);
    if (error) throw falhaDoBanco(error);
  }

  // ── auditoria ────────────────────────────────────────────────────────────

  async auditoria(
    db: Db,
    f: { limit: number; offset: number; entity?: string; actor_id?: string },
  ): Promise<{ linhas: RbacAuditEntry[]; total: number | null }> {
    let q = db
      .from('pv_rbac_audit_log')
      .select('id,actor_id,action,entity,entity_id,payload,created_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(f.offset, f.offset + f.limit - 1);
    if (f.entity) q = q.eq('entity', f.entity);
    if (f.actor_id) q = q.eq('actor_id', f.actor_id);
    const { data, error, count } = await q;
    if (error) throw falhaDoBanco(error);
    return { linhas: (data ?? []) as RbacAuditEntry[], total: count };
  }

  async negadosDesde(db: Db, desdeIso: string): Promise<number> {
    const { count, error } = await db
      .from('pv_rbac_audit_log')
      .select('id', { count: 'exact', head: true })
      .eq('action', 'access_denied')
      .gte('created_at', desdeIso);
    if (error) throw falhaDoBanco(error);
    return count ?? 0;
  }

  /** `current_user_permissions` (hook `usePermissions` de hoje, que chamava a RPC do navegador). */
  async minhasPermissoes(db: Db, companyId?: string): Promise<string[]> {
    const { data, error } = await db.rpc('current_user_permissions', { _company: companyId ?? undefined } as never);
    if (error) throw falhaDoBanco(error);
    return ((data as unknown) as string[] | null) ?? [];
  }
}
