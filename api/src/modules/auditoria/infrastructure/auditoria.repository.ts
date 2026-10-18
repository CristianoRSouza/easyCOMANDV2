import { Injectable } from '@nestjs/common';
import { falhaDoBanco } from '../../../common/erros';
import type { UserSupabaseClient } from '../../../db/user-supabase';
import { contem, type FiltrosDePermissao, type LinhaDaRpcEcp } from '../domain/auditoria';

type Db = UserSupabaseClient;

/**
 * O construtor de consulta do supabase-js é tipado por tabela; o filtro da auditoria de
 * permissões só precisa destes três métodos, então é descrito por eles.
 */
type ComFiltros<Q> = {
  gte(c: string, v: string): Q;
  lte(c: string, v: string): Q;
  ilike(c: string, v: string): Q;
  eq(c: string, v: string): Q;
};

/** `applyFilters` de hoje. */
function aplicarFiltros<Q extends ComFiltros<Q>>(q: Q, f: FiltrosDePermissao): Q {
  let b = q.gte('ts', f.from_iso).lte('ts', f.to_iso);
  const ator = contem(f.actor_email);
  const acao = contem(f.action);
  const tabela = contem(f.target_table);
  if (ator) b = b.ilike('actor_email', ator);
  if (acao) b = b.ilike('action', acao);
  if (tabela) b = b.ilike('target_table', tabela);
  if (f.source && f.source !== 'all') b = b.eq('source', f.source);
  return b;
}

/** Consultas das telas de auditoria, as MESMAS de hoje, com o cliente do usuário. */
@Injectable()
export class AuditoriaRepository {
  async atividade(
    db: Db,
    janela: { from: number; to: number },
    filtro: string | null,
  ): Promise<{ rows: unknown[]; total: number }> {
    let q = db
      .from('activity_logs')
      .select('id,created_at,user_email,category,action,entity_type,entity_id,summary,company_id', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(janela.from, janela.to);
    if (filtro) q = q.or(filtro);
    const { data, count, error } = await q;
    if (error) throw falhaDoBanco(error);
    return { rows: data ?? [], total: count ?? 0 };
  }

  async empresas(db: Db): Promise<Array<{ id: string; name: string }>> {
    const { data, error } = await db.from('pv_companies').select('id,name').order('name', { ascending: true }).limit(500);
    if (error) throw falhaDoBanco(error);
    return (data ?? []) as Array<{ id: string; name: string }>;
  }

  async ecpUnificada(
    db: Db,
    p: { company_id: string; source: string; action: string; user: string | null; from: string | null; limit: number; offset: number },
  ): Promise<LinhaDaRpcEcp[]> {
    const { data, error } = await db.rpc('get_ecp_unified_audit' as never, {
      _company_id: p.company_id,
      _source: p.source,
      _action: p.action,
      _user: p.user,
      _from: p.from,
      _limit: p.limit,
      _offset: p.offset,
    } as never);
    if (error) throw falhaDoBanco(error);
    return (data ?? []) as LinhaDaRpcEcp[];
  }

  async permissoes(db: Db, f: FiltrosDePermissao, janela: { from: number; to: number }, comDiferencas: boolean): Promise<unknown[]> {
    const colunas = comDiferencas
      ? 'id,ts,actor_user_id,actor_email,source,action,target_table,target_id,target_label,before,after,context'
      : 'id,ts,actor_user_id,actor_email,source,action,target_table,target_id,target_label,context';
    const q = db.from('pv_permission_audit_log').select(colunas).order('ts', { ascending: false }).range(janela.from, janela.to);
    const { data, error } = await aplicarFiltros(q, f);
    if (error) throw falhaDoBanco(error);
    return data ?? [];
  }

  async contarPermissoes(db: Db, f: FiltrosDePermissao): Promise<number> {
    const q = db.from('pv_permission_audit_log').select('id', { count: 'estimated', head: true });
    const { count, error } = await aplicarFiltros(q, f);
    if (error) throw falhaDoBanco(error);
    return count ?? 0;
  }
}
