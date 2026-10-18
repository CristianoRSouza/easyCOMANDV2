import { Injectable } from '@nestjs/common';
import { falhaDoBanco } from '../../../common/erros';
import { noSchema } from '../../../db/billing-schema';
import type { UserSupabaseClient } from '../../../db/user-supabase';

type Db = UserSupabaseClient;
type Contagem = PromiseLike<{ count: number | null }>;

/**
 * Consultas do dashboard e das telas de módulo, as MESMAS de hoje, com o cliente do usuário.
 * As contagens usam `head: true` (só o total, sem linhas).
 */
@Injectable()
export class PainelRepository {
  /**
   * As 13 consultas do `useDashboardKpis`, em paralelo. Erro em qualquer uma vira contagem 0 —
   * como hoje (`counts[i].count ?? 0`).
   */
  async kpis(db: Db, j: { cincoMin: string; umDia: string; trintaDias: string }) {
    const contar = (q: Contagem) => Promise.resolve(q).then((r) => r.count ?? 0);
    const tudo = { count: 'exact' as const, head: true };
    const connect = noSchema(db, 'connect');
    const billing = noSchema(db, 'billing');
    const [
      companies,
      stores,
      totemsActive,
      totemsOnline,
      totemLicenses,
      nfceAgents,
      recentActivity,
      mlConnectionsActive,
      mlProductLinks,
      mlProductKits,
      mlOrders30d,
      receita,
      mlAiCalls30d,
    ] = await Promise.all([
      contar(db.from('pv_companies').select('*', tudo)),
      contar(db.from('pv_stores').select('*', tudo).eq('is_active', true)),
      contar(db.from('vw_devices_totem_config').select('*', tudo).eq('is_active', true)),
      contar(db.from('vw_devices_totem_config').select('*', tudo).gte('last_heartbeat_at', j.cincoMin)),
      contar(db.from('vw_totem_licenses').select('*', tudo)),
      contar(db.from('vw_nfce_service_agent').select('*', tudo).eq('is_active', true)),
      contar(db.from('activity_logs').select('*', tudo).gte('created_at', j.umDia)),
      contar(connect.from('connections').select('*', tudo).eq('status', 'active')),
      contar(connect.from('product_links').select('*', tudo).or('license_suspended.is.null,license_suspended.eq.false')),
      contar(connect.from('product_kits').select('*', tudo).or('license_suspended.is.null,license_suspended.eq.false')),
      contar(connect.from('ml_orders').select('*', tudo).gte('date_created', j.trintaDias)),
      connect
        .from('ml_orders')
        .select('total_amount')
        .gte('date_created', j.trintaDias)
        .in('status', ['paid', 'shipped', 'delivered'])
        .then((r) => (r.data ?? []) as Array<{ total_amount: number | string | null }>),
      contar(billing.from('usage_log').select('*', tudo).gte('created_at', j.trintaDias)),
    ]);
    return {
      contagens: {
        companies,
        stores,
        totemsActive,
        totemsOnline,
        totemLicenses,
        nfceAgents,
        recentActivity,
        mlConnectionsActive,
        mlProductLinks,
        mlProductKits,
        mlOrders30d,
        mlAiCalls30d,
      },
      receita,
    };
  }

  // ── EasyCommandPay ──
  async totens(db: Db): Promise<unknown[]> {
    const { data, error } = await db
      .from('vw_devices_totem_config')
      .select('id,totem_name,is_active,last_heartbeat_at,heartbeat_machine_id,store_id,company_id')
      .order('last_heartbeat_at', { ascending: false, nullsFirst: false })
      .limit(200);
    if (error) throw falhaDoBanco(error);
    return data ?? [];
  }

  async agentes(db: Db): Promise<unknown[]> {
    const { data, error } = await db
      .from('vw_nfce_service_agent')
      .select('id,agent_name,is_active,contingency_enabled,sync_service_enabled,store_id,updated_at')
      .order('updated_at', { ascending: false, nullsFirst: false })
      .limit(200);
    if (error) throw falhaDoBanco(error);
    return data ?? [];
  }

  /** RPC de KPIs (`get_easycommandpay_kpis` / `get_easyml_kpis`). Sem dado → `{}`. */
  async rpcDeKpis(db: Db, nome: 'get_easycommandpay_kpis' | 'get_easyml_kpis'): Promise<unknown> {
    const { data, error } = await db.rpc(nome as never);
    if (error) throw falhaDoBanco(error);
    return data ?? {};
  }

  // ── EasyML Connect ──
  async conexoes(db: Db): Promise<unknown[]> {
    const { data, error } = await noSchema(db, 'connect')
      .from('connections')
      .select('id,external_account_name,external_user_id,status,token_expires_at,last_token_refresh_at,company_id,store_id,updated_at')
      .order('updated_at', { ascending: false })
      .limit(200);
    if (error) throw falhaDoBanco(error);
    return data ?? [];
  }

  async pedidosMl(db: Db): Promise<unknown[]> {
    const { data, error } = await noSchema(db, 'connect')
      .from('ml_orders')
      .select('id,ml_order_id,buyer_nickname,total_amount,currency_id,status,date_created,imported_to_erp,store_id')
      .order('date_created', { ascending: false, nullsFirst: false })
      .limit(500);
    if (error) throw falhaDoBanco(error);
    return data ?? [];
  }

  async usoDeIa(db: Db): Promise<unknown[]> {
    const { data, error } = await noSchema(db, 'billing')
      .from('usage_log_enriched')
      .select('id,created_at,module,function_name,action,model_used,tokens_total,credits_consumed,status,duration_ms,was_free,platform_display_name')
      .order('created_at', { ascending: false })
      .limit(500);
    if (error) throw falhaDoBanco(error);
    return data ?? [];
  }
}
