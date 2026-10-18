import { z } from 'zod';

/**
 * Hoje as abas mandam o `patch` direto ao PostgREST, sem validação nenhuma além do tipo TS. Aqui
 * cada patch é uma LISTA FECHADA dos campos que a tela de hoje edita (`ModulePlanPatch`,
 * `AiCreditPackagePatch`, `AiModelCostPatch`) — campo fora da lista é recusado com 400, em vez de
 * chegar ao banco. Os números aceitam o que a tela manda (number); jsonb aceita qualquer coisa.
 */

// A tela de planos manda `null` quando o campo numérico é apagado (e o banco decide se aceita):
// por isso os números do patch de plano aceitam `null`, como hoje chegavam ao PostgREST.
const num = z.number();
const numNulo = z.number().nullable();
const numDoPlano = z.number().nullable();
const qualquer = z.unknown();

export const ConfigQuerySchema = z.object({ category: z.string().optional() });
export type ConfigQuery = z.infer<typeof ConfigQuerySchema>;

export const ValorDeConfigSchema = z.object({ value: z.record(z.unknown()) });
export type ValorDeConfig = z.infer<typeof ValorDeConfigSchema>;

export const PlanosQuerySchema = z.object({ module: z.string().min(1).default('easycommandpay-totem') });
export type PlanosQuery = z.infer<typeof PlanosQuerySchema>;

export const PatchDePlanoSchema = z
  .object({
    name: z.string().nullable(),
    tier: z.string().nullable(),
    price_brl: numDoPlano,
    additional_user_price_brl: numDoPlano,
    base_software_brl: numDoPlano,
    additional_software_brl: numDoPlano,
    base_tef_brl: numDoPlano,
    additional_tef_brl: numDoPlano,
    history_window_days: numNulo,
    pix_fee_pct: numDoPlano,
    max_users: numDoPlano,
    is_active: z.boolean(),
    is_mock: z.boolean(),
    coming_soon: z.boolean(),
    sort_order: numDoPlano,
    volume_discounts: qualquer,
    store_volume_discounts: qualquer,
    features: qualquer,
  })
  .partial()
  .strict();
export type PatchDePlano = z.infer<typeof PatchDePlanoSchema>;

export const PatchDePacoteSchema = z
  .object({
    name: z.string(),
    credits: num,
    bonus_credits: num,
    total_credits: num,
    price_brl: num,
    validity_days: num,
    stripe_price_id: z.string().nullable(),
    highlight: z.boolean(),
    is_active: z.boolean(),
    sort_order: num,
  })
  .partial()
  .strict();
export type PatchDePacote = z.infer<typeof PatchDePacoteSchema>;

export const PatchDeCustoSchema = z
  .object({
    display_name: z.string(),
    provider: z.string(),
    cost_per_1k_tokens: num,
    cost_per_image: numNulo,
    real_cost_usd_per_1k: numNulo,
    real_cost_usd_per_image: numNulo,
    is_default: z.boolean(),
    is_active: z.boolean(),
    sort_order: num,
  })
  .partial()
  .strict();
export type PatchDeCusto = z.infer<typeof PatchDeCustoSchema>;

export const UsoDoCacheSchema = z.object({
  days: z.coerce.number().int().min(1).max(365),
  app: z.string().optional(),
});
export type UsoDoCache = z.infer<typeof UsoDoCacheSchema>;

export const ModoStripeSchema = z.object({ mode: z.enum(['live', 'sandbox']) });
export type ModoStripeInput = z.infer<typeof ModoStripeSchema>;

export const SincronizarPlanosSchema = z.object({
  mode: z.enum(['test', 'live']),
  module: z.string().optional(),
});
export type SincronizarPlanos = z.infer<typeof SincronizarPlanosSchema>;
