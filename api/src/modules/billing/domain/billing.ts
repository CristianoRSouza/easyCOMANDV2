/**
 * Tipos e regras puras do faturamento — `easyCONTROL/src/lib/billing/*`, `lib/stripe-invoke.ts`
 * e as agregações de `routes/_admin.billing.tsx`.
 */

type ErroLike = { message?: unknown; details?: unknown; hint?: unknown; code?: unknown; error_description?: unknown };

/**
 * `describeBillingError` de hoje: junta message | details | hint | error_description | code.
 * É o texto que as abas de faturamento mostram no toast.
 */
export function descreverErroDeBilling(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  if (err && typeof err === 'object') {
    const e = err as ErroLike;
    const partes = [e.message, e.details, e.hint, e.error_description, e.code].filter(
      (v): v is string => typeof v === 'string' && v.trim().length > 0,
    );
    if (partes.length > 0) return partes.join(' | ');
  }
  return 'Falha ao consultar dados de faturamento no Supabase.';
}

// ── planos, pacotes e custos ───────────────────────────────────────────────

/** Pacote de créditos com os números já convertidos (o PostgREST manda `numeric` como string). */
export function normalizarPacote<T extends Record<string, unknown>>(p: T): T {
  const credits = Number(p.credits ?? 0);
  const bonus = Number(p.bonus_credits ?? 0);
  return {
    ...p,
    credits,
    bonus_credits: bonus,
    total_credits: Number(p.total_credits ?? credits + bonus),
    price_brl: Number(p.price_brl ?? 0),
  };
}

const numeroOuNulo = (v: unknown) => (v == null ? null : Number(v));

export function normalizarCustoDeModelo<T extends Record<string, unknown>>(m: T): T {
  return {
    ...m,
    cost_per_1k_tokens: Number(m.cost_per_1k_tokens ?? 0),
    cost_per_image: numeroOuNulo(m.cost_per_image),
    real_cost_usd_per_1k: numeroOuNulo(m.real_cost_usd_per_1k),
    real_cost_usd_per_image: numeroOuNulo(m.real_cost_usd_per_image),
  };
}

export interface AiCacheRow {
  created_at: string;
  model_used: string | null;
  tokens_input: number;
  tokens_cached: number;
  app_source: string | null;
}

export function normalizarLinhaDeCache(r: Record<string, unknown>): AiCacheRow {
  return {
    ...(r as unknown as AiCacheRow),
    tokens_input: Number(r.tokens_input ?? 0),
    tokens_cached: Number(r.tokens_cached ?? 0),
  };
}

/**
 * Cotação de referência (`billing.config` key `reference_usd_brl`): o `default` quando é número > 0,
 * senão `null`. O valor de recuo (5.25 no painel de margem) é da TELA, como hoje.
 */
export function cotacaoDeReferencia(valor: unknown): number | null {
  const v = (valor as { default?: unknown } | null)?.default;
  return typeof v === 'number' && v > 0 ? v : null;
}

// ── modo do Stripe ─────────────────────────────────────────────────────────

export type StripeMode = 'live' | 'sandbox';

/** Preferência salva: só `sandbox` é sandbox; qualquer outra coisa (ou nada) é live. */
export const modoDaPreferencia = (mode: unknown): StripeMode => (mode === 'sandbox' ? 'sandbox' : 'live');

// ── licenças ───────────────────────────────────────────────────────────────

export type UsoLinha = {
  company_id: string | null;
  module: string | null;
  credits_consumed: number | string | null;
  tokens_total: number | string | null;
};

export type LicencaDeEmpresa = {
  id: string;
  company_id: string;
  module: string | null;
  plan_name: string | null;
  license_type: string | null;
  is_active: boolean | null;
  max_users: number | null;
  max_stores: number | null;
  starts_at: string | null;
  expires_at: string | null;
};

export type PlanoDaEmpresa = LicencaDeEmpresa & {
  company_name: string | null;
  usage_events_30d: number;
  usage_credits_30d: number;
  usage_tokens_30d: number;
};

/** Junta licenças, nomes de empresa e o uso de 30 dias por empresa+módulo — a conta de hoje. */
export function planosComUso(
  licencas: LicencaDeEmpresa[],
  empresas: Array<{ id: string; name: string | null }>,
  uso: UsoLinha[],
): PlanoDaEmpresa[] {
  const nomes = new Map<string, string>();
  for (const c of empresas) nomes.set(c.id, c.name ?? '—');

  const porChave = new Map<string, { events: number; credits: number; tokens: number }>();
  for (const u of uso) {
    if (!u.company_id) continue;
    const chave = `${u.company_id}::${u.module ?? ''}`;
    const cur = porChave.get(chave) ?? { events: 0, credits: 0, tokens: 0 };
    cur.events += 1;
    cur.credits += Number(u.credits_consumed ?? 0);
    cur.tokens += Number(u.tokens_total ?? 0);
    porChave.set(chave, cur);
  }

  return licencas.map((l) => {
    const u = porChave.get(`${l.company_id}::${l.module ?? ''}`) ?? { events: 0, credits: 0, tokens: 0 };
    return {
      id: l.id,
      company_id: l.company_id,
      company_name: nomes.get(l.company_id) ?? null,
      module: l.module,
      plan_name: l.plan_name,
      license_type: l.license_type,
      is_active: l.is_active,
      max_users: l.max_users,
      max_stores: l.max_stores,
      starts_at: l.starts_at,
      expires_at: l.expires_at,
      usage_events_30d: u.events,
      usage_credits_30d: Number(u.credits.toFixed(4)),
      usage_tokens_30d: u.tokens,
    };
  });
}

/** Licença de totem com o nome da empresa (nome vazio vira "—"; sem empresa, `null`). */
export function comNomeDaEmpresa<T extends { company_id: string | null }>(
  linhas: T[],
  empresas: Array<{ id: string; name: string | null }>,
): Array<T & { company_name: string | null }> {
  const nomes = new Map<string, string>();
  for (const c of empresas) nomes.set(c.id, c.name ?? '—');
  return linhas.map((r) => ({ ...r, company_name: r.company_id ? nomes.get(r.company_id) ?? null : null }));
}

// ── sincronização de price ids dos pacotes de IA ───────────────────────────

export interface PrecoStripe {
  id: string;
  active: boolean;
  currency: string;
  unit_amount: number | null;
  lookup_key: string | null;
  nickname: string | null;
  metadata: Record<string, string>;
  product: string | { id: string; name?: string; metadata?: Record<string, string> };
}

export type PacoteParaSincronizar = { id: string; slug: string; name: string; price_brl: number; stripe_price_id: string | null };

/**
 * O preço do Stripe que corresponde a um pacote, pela MESMA ordem de tentativas de hoje:
 *   1. `metadata.slug` do preço ou do produto;
 *   2. `lookup_key`;
 *   3. `nickname` igual ao slug;
 *   4. valor em BRL (centavos) igual ao `price_brl`.
 */
export function precoDoPacote(pacote: PacoteParaSincronizar, precos: PrecoStripe[]): PrecoStripe | undefined {
  const slug = pacote.slug.toLowerCase();
  let achado = precos.find((p) => {
    const doPreco = (p.metadata?.slug ?? '').toLowerCase();
    const doProduto = typeof p.product === 'object' ? (p.product.metadata?.slug ?? '').toLowerCase() : '';
    return doPreco === slug || doProduto === slug;
  });
  if (!achado) achado = precos.find((p) => (p.lookup_key ?? '').toLowerCase() === slug);
  if (!achado) achado = precos.find((p) => (p.nickname ?? '').toLowerCase() === slug);
  if (!achado) {
    const centavos = Math.round(Number(pacote.price_brl) * 100);
    achado = precos.find((p) => p.currency === 'brl' && p.unit_amount === centavos);
  }
  return achado;
}

export interface ResultadoDaSincronizacao {
  mode: StripeMode;
  scanned: number;
  matched: number;
  updated: number;
  details: Array<{ slug: string; price_id: string | null; reason: string }>;
}
