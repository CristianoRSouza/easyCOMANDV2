import { Injectable } from '@nestjs/common';
import { falhaDoBanco } from '../../../common/erros';
import type { UserSupabaseClient } from '../../../db/user-supabase';

export type LojaLinha = { id: string; trade_name: string | null; legal_name: string | null; cnpj: string | null; company_id: string };

/** Lojas e nomes de empresa para os seletores do PIX (`usePixStores` de hoje), com o cliente do usuário. */
@Injectable()
export class LojasRepository {
  /** Paginada em blocos de 1000 (o teto do PostgREST), até 20 blocos — como hoje. */
  async todas(db: UserSupabaseClient): Promise<LojaLinha[]> {
    const tamanho = 1000;
    const lojas: LojaLinha[] = [];
    for (let pagina = 0; pagina < 20; pagina++) {
      const { data, error } = await db
        .from('pv_stores')
        .select('id,trade_name,legal_name,cnpj,company_id')
        .order('trade_name', { ascending: true })
        .range(pagina * tamanho, pagina * tamanho + tamanho - 1);
      if (error) throw falhaDoBanco(error);
      lojas.push(...((data ?? []) as LojaLinha[]));
      if (!data || data.length < tamanho) break;
    }
    return lojas;
  }

  /** Erro ignorado, como hoje: a loja sai sem nome de empresa. */
  async nomesDasEmpresas(db: UserSupabaseClient, ids: string[]): Promise<Map<string, string>> {
    const nomes = new Map<string, string>();
    if (!ids.length) return nomes;
    const { data } = await db.from('pv_companies').select('id,name').in('id', ids);
    for (const c of (data ?? []) as Array<{ id: string; name: string }>) nomes.set(c.id, c.name);
    return nomes;
  }
}
