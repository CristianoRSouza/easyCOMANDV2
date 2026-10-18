import { apiRequest } from "@/shared/http/api-client";
import type { StripeMode } from "../domain/billing";

export type { StripeMode } from "../domain/billing";

interface SyncResult {
  mode: "live" | "sandbox";
  scanned: number;
  matched: number;
  updated: number;
  details: Array<{ slug: string; price_id: string | null; reason: string }>;
}

/**
 * `syncAiCreditsStripePriceIds` de hoje: casa cada pacote de créditos com um preço ativo do Stripe
 * (no modo da preferência do usuário). Mesma assinatura (chamada sem argumentos úteis).
 */
export const syncAiCreditsStripePriceIds = (_opts?: unknown): Promise<SyncResult> =>
  apiRequest<SyncResult>("/billing/ai/credit-packages/sync-stripe", { method: "POST" });

/**
 * Um ambiente da Edge Function `stripe-sync-plans` — hoje `supabase.functions.invoke(...)` do
 * navegador. Devolve `{ data, error }` no MESMO formato do supabase-js, para a tela tratar igual.
 */
export async function invokeStripeSyncPlans(body: { mode: "test" | "live"; module?: string }): Promise<{
  data: unknown;
  error: { message: string } | null;
}> {
  try {
    return { data: await apiRequest<unknown>("/billing/stripe-sync-plans", { method: "POST", body }), error: null };
  } catch (e) {
    return { data: null, error: { message: e instanceof Error ? e.message : "erro desconhecido" } };
  }
}

/** Preferência de modo do Stripe guardada no servidor (`billing.user_stripe_mode`). */
export async function lerModoStripe(): Promise<StripeMode | null> {
  return (await apiRequest<{ mode: StripeMode | null }>("/billing/stripe-mode")).mode;
}

export async function gravarModoStripe(mode: StripeMode): Promise<void> {
  await apiRequest("/billing/stripe-mode", { method: "PUT", body: { mode } });
}
