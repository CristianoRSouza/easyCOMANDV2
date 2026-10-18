import { apiRequest, withQuery } from "@/shared/http/api-client";
import type { ChamadaComData } from "@/shared/http/server-fn";
import type { PixCredentialStatus, PixEnvironment } from "../domain/pix";

export type { PixCredentialStatus } from "../domain/pix";

/** As ações do `managePixCredentials` de hoje, traduzidas nas rotas REST da API. */
export type PixCredentialsAction =
  | { action: "list" }
  | {
      action: "save";
      store_id: string;
      company_id: string;
      environment: PixEnvironment;
      api_base_url?: string;
      basic_user?: string;
      basic_token?: string;
      secret_key?: string;
      insecure_tls?: boolean;
      enabled?: boolean;
    }
  | { action: "delete"; store_id: string; company_id: string; environment: PixEnvironment };

export async function despacharCredenciais(input: PixCredentialsAction): Promise<unknown> {
  switch (input.action) {
    case "list":
      return apiRequest<{ credentials: PixCredentialStatus[] }>("/pix/credentials");
    case "save": {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { action: _a, ...corpo } = input;
      return apiRequest("/pix/credentials", { method: "PUT", body: corpo });
    }
    case "delete":
      return apiRequest(
        withQuery("/pix/credentials", { store_id: input.store_id, company_id: input.company_id, environment: input.environment }),
        { method: "DELETE" },
      );
  }
}

/**
 * Mesma assinatura da server function de hoje (`managePixCredentials({ data })`), com o retorno
 * tipado por ação como hoje: `list` → `{ credentials }`; `save`/`delete` → `{ ok: true }`.
 */
export function managePixCredentials(c: ChamadaComData<{ action: "list" }>): Promise<{ credentials: PixCredentialStatus[] }>;
export function managePixCredentials(c: ChamadaComData<Exclude<PixCredentialsAction, { action: "list" }>>): Promise<{ ok: true }>;
export function managePixCredentials({ data }: ChamadaComData<PixCredentialsAction>): Promise<unknown> {
  return despacharCredenciais(data);
}
