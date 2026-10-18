import { gravarModoStripe, lerModoStripe } from "./stripe-sync.functions";
import type { StripeMode } from "../domain/billing";

export type { StripeMode } from "../domain/billing";

/**
 * Preferência de modo do Stripe — `easyCONTROL/src/lib/stripe-invoke.ts`, com o mesmo cache no
 * localStorage (por usuário) e o mesmo evento `stripe-mode-changed`. A diferença é só o caminho:
 * a leitura/gravação vai pela API em vez do Supabase direto.
 */
export const STRIPE_MODE_STORAGE_KEY = "stripe_mode";

function cacheKey(userId?: string | null) {
  return userId ? `${STRIPE_MODE_STORAGE_KEY}:${userId}` : STRIPE_MODE_STORAGE_KEY;
}

/** Leitura síncrona do cache (por usuário quando informado). Padrão: "live". */
export function getStripeMode(userId?: string | null): StripeMode {
  if (typeof window === "undefined") return "live";
  const v = localStorage.getItem(cacheKey(userId)) ?? localStorage.getItem(STRIPE_MODE_STORAGE_KEY);
  return v === "sandbox" ? "sandbox" : "live";
}

/** Busca a preferência no servidor e atualiza o cache. Falha → o valor do cache, como hoje. */
export async function fetchStripeMode(userId: string): Promise<StripeMode> {
  let mode: StripeMode | null;
  try {
    mode = await lerModoStripe();
  } catch (e) {
    console.warn("[stripe-mode] fetch failed", e instanceof Error ? e.message : e);
    return getStripeMode(userId);
  }
  if (mode === null) return getStripeMode(userId);
  if (typeof window !== "undefined") {
    localStorage.setItem(cacheKey(userId), mode);
    localStorage.setItem(STRIPE_MODE_STORAGE_KEY, mode);
  }
  return mode;
}

/** Grava a preferência e atualiza o cache. */
export async function setStripeMode(userId: string, mode: StripeMode): Promise<void> {
  await gravarModoStripe(mode);
  if (typeof window !== "undefined") {
    localStorage.setItem(cacheKey(userId), mode);
    localStorage.setItem(STRIPE_MODE_STORAGE_KEY, mode);
    window.dispatchEvent(new CustomEvent("stripe-mode-changed", { detail: mode }));
  }
}
