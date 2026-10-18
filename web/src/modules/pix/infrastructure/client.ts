import { apiRequest, withQuery } from "@/shared/http/api-client";
import { ApiError } from "@/shared/http/api-error";
import type { PixApiError, PixEndpoint, PixEnvironment, PixType } from "../domain/pix";

export * from "../domain/pix";

/**
 * Endpoints de webhook na EasyERP-API. Hoje o NAVEGADOR chamava a EasyERP-API direto, com o token
 * da sessão; agora quem chama é a nossa API (o navegador não tem mais token) — e o erro volta com o
 * MESMO formato (`code`, `statusCode`, `details`) que as telas leem.
 */
async function pedir<T>(caminho: string, init?: { method: "POST"; body: unknown }): Promise<T> {
  try {
    return await apiRequest<T>(caminho, init);
  } catch (e) {
    if (!(e instanceof ApiError)) throw e;
    const corpo = (e.body && typeof e.body === "object" ? e.body : {}) as { details?: PixApiError["details"] };
    const erro = new Error(e.message) as PixApiError;
    if (e.code && !e.code.startsWith("http_")) erro.code = e.code;
    erro.statusCode = e.status;
    if (corpo.details) erro.details = corpo.details;
    throw erro;
  }
}

export async function listPixEndpoints(params?: { storeId?: string; apenasAtivos?: boolean }): Promise<PixEndpoint[]> {
  return pedir<PixEndpoint[]>(
    withQuery("/pix/endpoints", { store_id: params?.storeId, apenas_ativos: params?.apenasAtivos ? "true" : undefined }),
  );
}

export async function registerPixEndpoint(input: {
  store_id: string;
  environment: PixEnvironment;
  pix_type: PixType;
  company_id?: string;
}) {
  return pedir<{ endpointId: string; url: string; cadastrarNoPainel: boolean }>("/pix/endpoints/register", {
    method: "POST",
    body: input,
  });
}

export async function deactivatePixEndpoint(input: { store_id: string; environment: PixEnvironment; pix_type: PixType }) {
  return pedir<{ desativados: number }>("/pix/endpoints/deactivate", { method: "POST", body: input });
}
