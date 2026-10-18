import { Injectable } from '@nestjs/common';
import { falhaDoBanco } from '../../../common/erros';
import type { UserSupabaseClient } from '../../../db/user-supabase';
import type { EmpresaLinha, LojaLinha } from '../domain/empresas';

/** Consultas de `pv_companies`/`pv_stores`, as MESMAS das telas de hoje, com o cliente do usuário. */
@Injectable()
export class EmpresasRepository {
  async empresas(db: UserSupabaseClient, filtro: string | null): Promise<EmpresaLinha[]> {
    let q = db
      .from('pv_companies')
      .select('id,name,cnpj,document,email,city,state,created_at')
      .order('name', { ascending: true })
      .limit(200);
    if (filtro) q = q.or(filtro);
    const { data, error } = await q;
    if (error) throw falhaDoBanco(error);
    return (data ?? []) as EmpresaLinha[];
  }

  /** Um `company_id` por loja (a contagem é feita na aplicação). Erro ignorado, como hoje. */
  async empresaDeCadaLoja(db: UserSupabaseClient, ids: string[]): Promise<string[]> {
    if (!ids.length) return [];
    const { data } = await db.from('pv_stores').select('company_id').in('company_id', ids);
    return ((data ?? []) as { company_id: string }[]).map((s) => s.company_id);
  }

  async lojas(db: UserSupabaseClient, f: { filtro: string | null; apenasAtivas: boolean }): Promise<LojaLinha[]> {
    let q = db
      .from('pv_stores')
      .select('id,trade_name,legal_name,cnpj,is_active,email,phone1,company_id,created_at')
      .order('trade_name', { ascending: true })
      .limit(300);
    if (f.apenasAtivas) q = q.eq('is_active', true);
    if (f.filtro) q = q.or(f.filtro);
    const { data, error } = await q;
    if (error) throw falhaDoBanco(error);
    return (data ?? []) as LojaLinha[];
  }

  /** Erro ignorado, como hoje. */
  async nomes(db: UserSupabaseClient, ids: string[]): Promise<Array<{ id: string; name: string }>> {
    if (!ids.length) return [];
    const { data } = await db.from('pv_companies').select('id,name').in('id', ids);
    return (data ?? []) as Array<{ id: string; name: string }>;
  }
}
