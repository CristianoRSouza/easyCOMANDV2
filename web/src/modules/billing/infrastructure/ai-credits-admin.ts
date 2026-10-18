import { apiRequest } from "@/shared/http/api-client";
import type { AiCreditPackagePatch, AiCreditPackageRow, AiModelCostPatch, AiModelCostRow } from "../domain/billing";

export type { AiCreditPackagePatch, AiCreditPackageRow, AiModelCostPatch, AiModelCostRow } from "../domain/billing";

/** Pacotes de créditos e custos por modelo — `easyCONTROL/src/lib/billing/ai-credits-admin.ts`, pela API. */

export async function fetchAiCreditPackagesAdmin(): Promise<AiCreditPackageRow[]> {
  return apiRequest<AiCreditPackageRow[]>("/billing/ai/credit-packages");
}

export async function updateAiCreditPackage(id: string, patch: AiCreditPackagePatch): Promise<void> {
  await apiRequest(`/billing/ai/credit-packages/${encodeURIComponent(id)}`, { method: "PATCH", body: patch });
}

export async function fetchAiModelCostsAdmin(): Promise<AiModelCostRow[]> {
  return apiRequest<AiModelCostRow[]>("/billing/ai/model-costs");
}

export async function updateAiModelCost(id: string, patch: AiModelCostPatch): Promise<void> {
  await apiRequest(`/billing/ai/model-costs/${encodeURIComponent(id)}`, { method: "PATCH", body: patch });
}

/** Recuo do painel de margem quando a referência não está cadastrada — o `DEFAULT_REFERENCE` de hoje. */
const REFERENCIA_PADRAO = 5.25;

/** Cotação USD→BRL de referência (`billing.config` `reference_usd_brl`); ausente → 5.25. */
export async function fetchReferenceUsdBrl(): Promise<number> {
  return (await apiRequest<{ value: number | null }>("/billing/config/reference-usd-brl")).value ?? REFERENCIA_PADRAO;
}
