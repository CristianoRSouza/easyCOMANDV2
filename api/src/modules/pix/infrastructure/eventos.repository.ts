import { Injectable } from '@nestjs/common';
import { falhaDoBanco } from '../../../common/erros';
import { noSchema } from '../../../db/billing-schema';
import { ServiceRole } from '../../../db/service-role';
import type { PixEventRow, PixFeedEvent } from '../domain/pix';

export type FiltroDoResumo = { endpoint_id?: string; store_id?: string; environment?: string };
export type FiltroDoFeed = FiltroDoResumo & {
  pix_type?: string;
  outcome?: string;
  busca: string | null;
  cursor?: string;
  limite: number;
};

const COLUNAS_RESUMO =
  'id,endpoint_id,store_id,pix_type,environment,status,outcome,tx_id,e2e_id,valor,received_at,processed_at,last_error';
const COLUNAS_FEED =
  'id,endpoint_id,company_id,store_id,pix_type,environment,status,outcome,tx_id,e2e_id,qrcode_id,pix_status,valor,emissao,attempts,body_bytes,payload,received_at,processed_at,last_error';

/**
 * `webhook.pixnopdv_events` — com a SERVICE_ROLE, como hoje (o schema `webhook` não tem policy
 * para o usuário). Quem chama já passou pelo gate de admin legado.
 */
@Injectable()
export class EventosRepository {
  constructor(private readonly serviceRole: ServiceRole) {}

  /**
   * Com loja ou endpoint: até 100; sem: até 1000 (o painel geral). Loja vence endpoint, como hoje
   * (`if store_id … else if endpoint_id`).
   */
  async paraResumo(f: FiltroDoResumo): Promise<PixEventRow[]> {
    return this.serviceRole.run('pix-eventos', async (admin) => {
      const escopado = Boolean(f.endpoint_id || f.store_id);
      let q = noSchema(admin, 'webhook')
        .from('pixnopdv_events')
        .select(COLUNAS_RESUMO)
        .order('received_at', { ascending: false })
        .limit(escopado ? 100 : 1000);
      if (f.store_id) q = q.eq('store_id', f.store_id);
      else if (f.endpoint_id) q = q.eq('endpoint_id', f.endpoint_id);
      if (f.environment) q = q.eq('environment', f.environment);
      const { data, error } = await q;
      if (error) throw falhaDoBanco(error);
      return (data ?? []) as PixEventRow[];
    });
  }

  async paraFeed(f: FiltroDoFeed): Promise<Array<Omit<PixFeedEvent, 'payload'> & { payload: unknown }>> {
    return this.serviceRole.run('pix-eventos', async (admin) => {
      let q = noSchema(admin, 'webhook')
        .from('pixnopdv_events')
        .select(COLUNAS_FEED)
        .order('received_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(f.limite + 1);
      if (f.endpoint_id) q = q.eq('endpoint_id', f.endpoint_id);
      if (f.store_id) q = q.eq('store_id', f.store_id);
      if (f.environment) q = q.eq('environment', f.environment);
      if (f.pix_type) q = q.eq('pix_type', f.pix_type);
      if (f.outcome) q = q.eq('outcome', f.outcome);
      if (f.cursor) q = q.lt('received_at', f.cursor);
      if (f.busca) q = q.or(f.busca);
      const { data, error } = await q;
      if (error) throw falhaDoBanco(error);
      return (data ?? []) as Array<Omit<PixFeedEvent, 'payload'> & { payload: unknown }>;
    });
  }
}
