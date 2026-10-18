/**
 * Consultas do schema `billing` para as abas de Planos & Preços e Configurações Globais — as
 * MESMAS funções de `easyCONTROL/src/lib/billing/queries.ts`, agora pela API (hoje elas iam do
 * navegador direto ao Supabase).
 *
 * O texto dos erros não muda: a API devolve no `message` o mesmo `describeBillingError` de hoje.
 */
import { apiRequest, withQuery } from "@/shared/http/api-client";
import type { BillingConfigRow, ModulePlanAdminRow, ModulePlanPatch } from "../domain/billing";

export { describeBillingError } from "../domain/billing";
export type { BillingConfigRow, BillingPlan, ModulePlanAdminRow, ModulePlanPatch } from "../domain/billing";

export async function fetchBillingConfig(category?: string): Promise<BillingConfigRow[]> {
  return apiRequest<BillingConfigRow[]>(withQuery("/billing/config", { category }));
}

export async function updateBillingConfigValue(id: string, value: Record<string, unknown>): Promise<void> {
  await apiRequest(`/billing/config/${encodeURIComponent(id)}`, { method: "PATCH", body: { value } });
}

export async function fetchModulePlansAdmin(module = "easycommandpay-totem"): Promise<ModulePlanAdminRow[]> {
  return apiRequest<ModulePlanAdminRow[]>(withQuery("/billing/module-plans", { module }));
}

export async function updateModulePlan(id: string, patch: ModulePlanPatch): Promise<void> {
  await apiRequest(`/billing/module-plans/${encodeURIComponent(id)}`, { method: "PATCH", body: patch });
}
