import { Injectable } from '@nestjs/common';
import { conflito, falhaDoBanco } from '../../../common/erros';
import type { UserSupabaseClient } from '../../../db/user-supabase';
import {
  MSG_VINCULO_DUPLICADO,
  type EmpresaResumo,
  type PerfilResumo,
  type StatusDoVinculo,
  type VinculoLinha,
} from '../domain/vinculos';

export type FiltrosDeVinculo = {
  status: StatusDoVinculo | 'all';
  company_id?: string;
  user_ids: string[] | null;
};

/** Consultas de `pb_user_company_access` e afins, com o cliente do usuário (RLS). */
@Injectable()
export class VinculosRepository {
  /** Pré-filtro por usuário: até 500 perfis cujo e-mail ou nome casa com a busca. */
  async idsDosPerfisQueCasam(db: UserSupabaseClient, filtro: string): Promise<string[]> {
    const { data } = await db.from('pb_profiles').select('id').or(filtro).limit(500);
    return ((data ?? []) as { id: string }[]).map((p) => p.id);
  }

  async listar(
    db: UserSupabaseClient,
    janela: { from: number; to: number },
    f: FiltrosDeVinculo,
  ): Promise<{ linhas: VinculoLinha[]; total: number | null }> {
    let q = db
      .from('pb_user_company_access')
      .select('id,user_id,company_id,status,approved_by,approved_at,created_at', { count: 'estimated' })
      .order('created_at', { ascending: false });
    if (f.status !== 'all') q = q.eq('status', f.status);
    if (f.company_id) q = q.eq('company_id', f.company_id);
    if (f.user_ids) q = q.in('user_id', f.user_ids);
    const { data, error, count } = await q.range(janela.from, janela.to);
    if (error) throw falhaDoBanco(error);
    return { linhas: (data ?? []) as VinculoLinha[], total: count };
  }

  async perfis(db: UserSupabaseClient, ids: string[]): Promise<PerfilResumo[]> {
    if (!ids.length) return [];
    const { data } = await db.from('pb_profiles').select('id,email,full_name').in('id', ids);
    return (data ?? []) as PerfilResumo[];
  }

  async empresas(db: UserSupabaseClient, ids: string[]): Promise<EmpresaResumo[]> {
    if (!ids.length) return [];
    const { data } = await db.from('pv_companies').select('id,name').in('id', ids);
    return (data ?? []) as EmpresaResumo[];
  }

  async todasAsEmpresas(db: UserSupabaseClient): Promise<EmpresaResumo[]> {
    const { data, error } = await db.from('pv_companies').select('id,name').order('name');
    if (error) throw falhaDoBanco(error);
    return (data ?? []) as EmpresaResumo[];
  }

  async buscarUsuarios(db: UserSupabaseClient, filtro: string | null): Promise<PerfilResumo[]> {
    let q = db.from('pb_profiles').select('id,email,full_name').order('email').limit(100);
    if (filtro) q = q.or(filtro);
    const { data, error } = await q;
    if (error) throw falhaDoBanco(error);
    return (data ?? []) as PerfilResumo[];
  }

  async criar(db: UserSupabaseClient, linha: Record<string, unknown>): Promise<Record<string, unknown>> {
    const { data, error } = await db.from('pb_user_company_access').insert(linha as never).select().single();
    if (error) {
      if (error.code === '23505') throw conflito(MSG_VINCULO_DUPLICADO);
      throw falhaDoBanco(error);
    }
    return data as Record<string, unknown>;
  }

  async atualizar(
    db: UserSupabaseClient,
    id: string,
    patch: Record<string, unknown>,
  ): Promise<{ id: string; user_id: string; company_id: string }> {
    const { data, error } = await db
      .from('pb_user_company_access')
      .update(patch as never)
      .eq('id', id)
      .select('id,user_id,company_id')
      .single();
    if (error) throw falhaDoBanco(error);
    return data as { id: string; user_id: string; company_id: string };
  }

  async donoDoVinculo(db: UserSupabaseClient, id: string): Promise<{ user_id?: string; company_id?: string } | null> {
    const { data } = await db.from('pb_user_company_access').select('user_id,company_id').eq('id', id).maybeSingle();
    return data as { user_id?: string; company_id?: string } | null;
  }

  async excluir(db: UserSupabaseClient, id: string): Promise<void> {
    const { error } = await db.from('pb_user_company_access').delete().eq('id', id);
    if (error) throw falhaDoBanco(error);
  }
}
