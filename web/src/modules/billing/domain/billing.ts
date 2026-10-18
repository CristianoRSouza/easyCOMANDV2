/** Tipos do faturamento — os de `easyCONTROL/src/lib/billing/{queries,ai-credits-admin}.ts`. */

type ErrorLike = {
  message?: unknown;
  details?: unknown;
  hint?: unknown;
  code?: unknown;
  error_description?: unknown;
};

/** `describeBillingError` de hoje (as abas o usam para montar o texto do toast). */
export function describeBillingError(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  if (err && typeof err === "object") {
    const e = err as ErrorLike;
    const parts = [e.message, e.details, e.hint, e.error_description, e.code].filter(
      (v): v is string => typeof v === "string" && v.trim().length > 0,
    );
    if (parts.length > 0) return parts.join(" | ");
  }
  return "Falha ao consultar dados de faturamento no Supabase.";
}

export interface BillingPlan {
  slug: string;
  name: string;
  tier: string | null;
  price_brl: number;
  additional_user_price_brl: number;
  base_software_brl: number;
  additional_software_brl: number;
  base_tef_brl: number;
  additional_tef_brl: number;
  history_window_days: number | null;
  pix_fee_pct: number;
  is_mock: boolean;
  is_active: boolean;
  coming_soon: boolean;
  sort_order: number;
  features: unknown;
  volume_discounts: unknown;
  store_volume_discounts: unknown;
}

export interface BillingConfigRow {
  id: string;
  category: string;
  key: string;
  value: Record<string, unknown> & { default?: unknown };
  description: string | null;
  updated_at: string;
}

export interface ModulePlanAdminRow extends BillingPlan {
  id: string;
  module: string;
  max_users: number;
  updated_at: string;
}

export type ModulePlanPatch = Partial<{
  name: string;
  tier: string | null;
  price_brl: number;
  additional_user_price_brl: number;
  base_software_brl: number;
  additional_software_brl: number;
  base_tef_brl: number;
  additional_tef_brl: number;
  history_window_days: number | null;
  pix_fee_pct: number;
  max_users: number;
  is_active: boolean;
  is_mock: boolean;
  coming_soon: boolean;
  sort_order: number;
  volume_discounts: unknown;
  store_volume_discounts: unknown;
  features: unknown;
}>;

export interface AiCreditPackageRow {
  id: string;
  slug: string;
  name: string;
  credits: number;
  bonus_credits: number;
  total_credits: number;
  price_brl: number;
  validity_days: number;
  stripe_price_id: string | null;
  highlight: boolean;
  is_active: boolean;
  sort_order: number;
}

export type AiCreditPackagePatch = Partial<{
  name: string;
  credits: number;
  bonus_credits: number;
  total_credits: number;
  price_brl: number;
  validity_days: number;
  stripe_price_id: string | null;
  highlight: boolean;
  is_active: boolean;
  sort_order: number;
}>;

export interface AiModelCostRow {
  id: string;
  model_key: string;
  display_name: string;
  provider: string;
  cost_per_1k_tokens: number;
  cost_per_image: number | null;
  real_cost_usd_per_1k: number | null;
  real_cost_usd_per_image: number | null;
  is_default: boolean;
  is_active: boolean;
  sort_order: number;
}

export type AiModelCostPatch = Partial<{
  display_name: string;
  provider: string;
  cost_per_1k_tokens: number;
  cost_per_image: number | null;
  real_cost_usd_per_1k: number | null;
  real_cost_usd_per_image: number | null;
  is_default: boolean;
  is_active: boolean;
  sort_order: number;
}>;

export type StripeMode = "sandbox" | "live";
