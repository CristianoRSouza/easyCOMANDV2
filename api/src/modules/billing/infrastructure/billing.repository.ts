import { Injectable } from '@nestjs/common';
import { ErroDeRegra, falhaDoBanco } from '../../../common/erros';
import { noSchema } from '../../../db/billing-schema';
import type { UserSupabaseClient } from '../../../db/user-supabase';
import {
  descreverErroDeBilling,
  type LicencaDeEmpresa,
  type PacoteParaSincronizar,
  type UsoLinha,
} from '../domain/billing';

type Db = UserSupabaseClient;
type Linha = Record<string, unknown>;

/** Erro do schema billing com o texto de `describeBillingError` (message | details | hint | code). */
const erroDeBilling = (e: unknown) => new ErroDeRegra(descreverErroDeBilling(e), 'banco');

/**
 * Consultas do schema `billing` e das views de licença, com o cliente do USUÁRIO (RLS) — hoje
 * elas rodavam direto do NAVEGADOR, com a mesma sessão.
 */
@Injectable()
export class BillingRepository {
  // ── config ──
  async config(db: Db, categoria?: string): Promise<Linha[]> {
    let q = noSchema(db, 'billing')
      .from('config')
      .select('id,category,key,value,description,updated_at')
      .order('category', { ascending: true })
      .order('key', { ascending: true });
    if (categoria) q = q.eq('category', categoria);
    const { data, error } = await q;
    if (error) throw erroDeBilling(error);
    return (data ?? []) as Linha[];
  }

  async atualizarConfig(db: Db, id: string, valor: Record<string, unknown>, agora: Date): Promise<void> {
    const { error } = await noSchema(db, 'billing')
      .from('config')
      .update({ value: valor, updated_at: agora.toISOString() })
      .eq('id', id);
    if (error) throw erroDeBilling(error);
  }

  /** Erro ignorado, como hoje (`MarginMonitorSection`): sem valor, a tela usa 5.0. */
  async valorDaCotacao(db: Db): Promise<unknown> {
    const { data } = await noSchema(db, 'billing').from('config').select('value').eq('key', 'reference_usd_brl').maybeSingle();
    return (data as { value?: unknown } | null)?.value ?? null;
  }

  // ── planos por módulo ──
  async planos(db: Db, modulo: string): Promise<Linha[]> {
    const { data, error } = await noSchema(db, 'billing')
      .from('module_plans')
      .select(
        'id,slug,module,name,tier,price_brl,additional_user_price_brl,base_software_brl,additional_software_brl,base_tef_brl,additional_tef_brl,history_window_days,pix_fee_pct,max_users,is_mock,is_active,coming_soon,sort_order,features,volume_discounts,store_volume_discounts,updated_at',
      )
      .eq('module', modulo)
      .order('sort_order', { ascending: true });
    if (error) throw erroDeBilling(error);
    return (data ?? []) as Linha[];
  }

  async atualizarPlano(db: Db, id: string, patch: Linha, agora: Date): Promise<void> {
    const { error } = await noSchema(db, 'billing')
      .from('module_plans')
      .update({ ...patch, updated_at: agora.toISOString() })
      .eq('id', id);
    if (error) throw erroDeBilling(error);
  }

  // ── pacotes de crédito e custos de modelo ──
  async pacotes(db: Db): Promise<Linha[]> {
    const { data, error } = await noSchema(db, 'billing')
      .from('credit_packages')
      .select('id,slug,name,credits,bonus_credits,total_credits,price_brl,validity_days,stripe_price_id,highlight,is_active,sort_order')
      .order('sort_order', { ascending: true });
    if (error) throw erroDeBilling(error);
    return (data ?? []) as Linha[];
  }

  async atualizarPacote(db: Db, id: string, patch: Linha): Promise<void> {
    const { error } = await noSchema(db, 'billing').from('credit_packages').update(patch).eq('id', id);
    if (error) throw erroDeBilling(error);
  }

  async custos(db: Db): Promise<Linha[]> {
    const { data, error } = await noSchema(db, 'billing')
      .from('model_costs')
      .select(
        'id,model_key,display_name,provider,cost_per_1k_tokens,cost_per_image,real_cost_usd_per_1k,real_cost_usd_per_image,is_default,is_active,sort_order',
      )
      .order('sort_order', { ascending: true });
    if (error) throw erroDeBilling(error);
    return (data ?? []) as Linha[];
  }

  async atualizarCusto(db: Db, id: string, patch: Linha): Promise<void> {
    const { error } = await noSchema(db, 'billing').from('model_costs').update(patch).eq('id', id);
    if (error) throw erroDeBilling(error);
  }

  /** Uso de IA para o painel de cache: até 50 mil linhas, como hoje. */
  async usoDeIaDesde(db: Db, desdeIso: string, app?: string): Promise<Linha[]> {
    let q = noSchema(db, 'billing')
      .from('usage_log')
      .select('created_at,model_used,tokens_input,tokens_cached,app_source')
      .eq('service_type', 'ai')
      .gte('created_at', desdeIso)
      .order('created_at', { ascending: true })
      .limit(50000);
    if (app && app !== 'all') q = q.eq('app_source', app);
    const { data, error } = await q;
    if (error) throw erroDeBilling(error);
    return (data ?? []) as Linha[];
  }

  // ── modo do Stripe (preferência por usuário) ──
  /** `null` quando a leitura falhou (quem chama decide o fallback). */
  async preferenciaDeModo(db: Db, userId: string): Promise<{ mode?: string } | null | 'erro'> {
    const { data, error } = await noSchema(db, 'billing').from('user_stripe_mode').select('mode').eq('user_id', userId).maybeSingle();
    if (error) return 'erro';
    return data as { mode?: string } | null;
  }

  async gravarPreferenciaDeModo(db: Db, userId: string, mode: string, agora: Date): Promise<void> {
    const { error } = await noSchema(db, 'billing')
      .from('user_stripe_mode')
      .upsert({ user_id: userId, mode, updated_at: agora.toISOString() }, { onConflict: 'user_id' });
    if (error) throw falhaDoBanco(error);
  }

  // ── sincronização de price ids ──
  async pacotesParaSincronizar(db: Db): Promise<PacoteParaSincronizar[]> {
    const { data, error } = await noSchema(db, 'billing').from('credit_packages').select('id,slug,name,price_brl,stripe_price_id');
    if (error) throw falhaDoBanco(error);
    return (data ?? []) as PacoteParaSincronizar[];
  }

  /** Devolve a mensagem de erro (a tela a mostra no detalhe do pacote) ou `null`. */
  async gravarPriceId(db: Db, pacoteId: string, priceId: string): Promise<string | null> {
    const { error } = await noSchema(db, 'billing').from('credit_packages').update({ stripe_price_id: priceId }).eq('id', pacoteId);
    return error ? error.message : null;
  }

  // ── licenças ──
  async licencasDeTotem(db: Db): Promise<Array<Linha & { company_id: string | null }>> {
    const { data, error } = await db
      .from('vw_totem_licenses')
      .select('id,device_type,device_key,license_type,status,starts_at,expires_at,max_transactions_month,store_id,company_id,created_at')
      .order('created_at', { ascending: false })
      .limit(300);
    if (error) throw falhaDoBanco(error);
    return (data ?? []) as Array<Linha & { company_id: string | null }>;
  }

  async empresas(db: Db): Promise<Array<{ id: string; name: string | null }>> {
    const { data, error } = await db.from('pv_companies').select('id,name');
    if (error) throw falhaDoBanco(error);
    return (data ?? []) as Array<{ id: string; name: string | null }>;
  }

  async licencasDeEmpresa(db: Db): Promise<LicencaDeEmpresa[]> {
    const { data, error } = await noSchema(db, 'billing')
      .from('company_licenses')
      .select('id,company_id,module,plan_name,license_type,is_active,max_users,max_stores,starts_at,expires_at')
      .order('is_active', { ascending: false });
    if (error) throw falhaDoBanco(error);
    return (data ?? []) as LicencaDeEmpresa[];
  }

  async usoDesde(db: Db, desdeIso: string): Promise<UsoLinha[]> {
    const { data, error } = await noSchema(db, 'billing')
      .from('usage_log_enriched')
      .select('company_id,module,credits_consumed,tokens_total,created_at')
      .gte('created_at', desdeIso);
    if (error) throw falhaDoBanco(error);
    return (data ?? []) as UsoLinha[];
  }

  // ── Edge Function de sincronização de planos ──
  /**
   * `supabase.functions.invoke("stripe-sync-plans")` de hoje, com o MESMO cliente do usuário — o
   * JWT dele vai no `Authorization`, e a função decide o que ele pode. Devolve o corpo da função
   * ou a mensagem de erro que o supabase-js produz (a tela a mostra no log da sincronização).
   */
  async sincronizarPlanos(db: Db, corpo: Linha): Promise<{ data: unknown } | { erro: string }> {
    const { data, error } = await db.functions.invoke('stripe-sync-plans', { body: corpo });
    if (error) return { erro: error.message ?? 'erro desconhecido' };
    return { data };
  }
}
