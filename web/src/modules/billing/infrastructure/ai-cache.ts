import { apiRequest, withQuery } from "@/shared/http/api-client";
import type { AiCacheRow } from "../domain/ai-cache";

export * from "../domain/ai-cache";

/** Linhas de uso de IA dos últimos `days` dias (`billing.usage_log`), pela API. */
export async function fetchAiCacheRows(params: { days: number; app?: string | "all" }): Promise<AiCacheRow[]> {
  return apiRequest<AiCacheRow[]>(withQuery("/billing/ai/cache-usage", { days: params.days, app: params.app }));
}
