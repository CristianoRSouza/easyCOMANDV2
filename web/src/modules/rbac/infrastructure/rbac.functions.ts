import { apiRequest, withQuery } from "@/shared/http/api-client";
import type { ChamadaComData } from "@/shared/http/server-fn";
import type { OverrideEffect, RbacScope } from "../domain/types";

/**
 * As ações do `manageRbac` de hoje (`easyCONTROL/src/lib/rbac/rbac.functions.ts`) — o MESMO
 * contrato de entrada que as telas montam —, cada uma traduzida na rota REST da API.
 */
export type RbacAction =
  | { action: "list_modules" }
  | { action: "upsert_module"; id?: string; key: string; name: string; description?: string | null; version?: string; is_active?: boolean }
  | { action: "list_permissions" }
  | { action: "upsert_permission"; id?: string; key: string; module_key: string; scope: RbacScope; description?: string | null; is_active?: boolean }
  | { action: "delete_permission"; id: string }
  | { action: "list_roles" }
  | { action: "upsert_role"; id?: string; key: string; name: string; description?: string | null; scope: RbacScope; permission_ids?: string[] }
  | { action: "duplicate_role"; source_id: string; new_key: string; new_name: string }
  | { action: "delete_role"; id: string }
  | { action: "list_user_assignments"; user_id?: string; company_id?: string }
  | { action: "search_users"; query?: string }
  | { action: "list_companies" }
  | { action: "list_stores"; company_id?: string }
  | { action: "assign_role"; user_id: string; role_id: string; company_id?: string | null; store_id?: string | null }
  | { action: "revoke_assignment"; assignment_id: string }
  | { action: "list_user_overrides"; user_id: string; company_id?: string }
  | { action: "set_user_override"; user_id: string; permission_id: string; effect: OverrideEffect; company_id?: string | null; store_id?: string | null }
  | { action: "delete_user_override"; id: string }
  | { action: "list_audit"; limit?: number; offset?: number; entity?: string; actor_id?: string }
  | { action: "log_access_denied"; path?: string; attempted_role?: string | null }
  | { action: "count_recent_denied"; hours?: number };

const enc = encodeURIComponent;

/** Separa a ação dos campos (o corpo da rota é o resto). */
function semAcao<T extends { action: string }>(input: T): Omit<T, "action"> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { action: _acao, ...resto } = input;
  return resto;
}

export async function despacharRbac(input: RbacAction): Promise<unknown> {
  switch (input.action) {
    case "list_modules":
      return apiRequest("/rbac/modules");
    case "upsert_module": {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { id, action: _a, ...corpo } = input;
      return id ? apiRequest(`/rbac/modules/${enc(id)}`, { method: "PUT", body: corpo }) : apiRequest("/rbac/modules", { method: "POST", body: corpo });
    }
    case "list_permissions":
      return apiRequest("/rbac/permissions");
    case "upsert_permission": {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { id, action: _a, ...corpo } = input;
      return id
        ? apiRequest(`/rbac/permissions/${enc(id)}`, { method: "PUT", body: corpo })
        : apiRequest("/rbac/permissions", { method: "POST", body: corpo });
    }
    case "delete_permission":
      return apiRequest(`/rbac/permissions/${enc(input.id)}`, { method: "DELETE" });
    case "list_roles":
      return apiRequest("/rbac/roles");
    case "upsert_role": {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { id, action: _a, ...corpo } = input;
      return id ? apiRequest(`/rbac/roles/${enc(id)}`, { method: "PUT", body: corpo }) : apiRequest("/rbac/roles", { method: "POST", body: corpo });
    }
    case "duplicate_role":
      return apiRequest(`/rbac/roles/${enc(input.source_id)}/duplicate`, {
        method: "POST",
        body: { new_key: input.new_key, new_name: input.new_name },
      });
    case "delete_role":
      return apiRequest(`/rbac/roles/${enc(input.id)}`, { method: "DELETE" });
    case "list_user_assignments":
      return apiRequest(withQuery("/rbac/assignments", { user_id: input.user_id, company_id: input.company_id }));
    case "search_users":
      return apiRequest(withQuery("/rbac/users", { query: input.query ?? "" }));
    case "list_companies":
      return apiRequest("/rbac/companies");
    case "list_stores":
      return apiRequest(withQuery("/rbac/stores", { company_id: input.company_id }));
    case "assign_role":
      return apiRequest("/rbac/assignments", { method: "POST", body: semAcao(input) });
    case "revoke_assignment":
      return apiRequest(`/rbac/assignments/${enc(input.assignment_id)}`, { method: "DELETE" });
    case "list_user_overrides":
      return apiRequest(withQuery("/rbac/overrides", { user_id: input.user_id, company_id: input.company_id }));
    case "set_user_override":
      return apiRequest("/rbac/overrides", { method: "POST", body: semAcao(input) });
    case "delete_user_override":
      return apiRequest(`/rbac/overrides/${enc(input.id)}`, { method: "DELETE" });
    case "list_audit":
      return apiRequest(
        withQuery("/rbac/audit", { limit: input.limit, offset: input.offset, entity: input.entity, actor_id: input.actor_id }),
      );
    case "log_access_denied":
      return apiRequest("/rbac/access-denied", { method: "POST", body: semAcao(input) });
    case "count_recent_denied":
      return apiRequest(withQuery("/rbac/access-denied/count", { hours: input.hours }));
  }
}

/** Mesma assinatura da server function de hoje (`manageRbac({ data })`). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const manageRbac = ({ data }: ChamadaComData<RbacAction>): Promise<any> => despacharRbac(data);

/** Chaves de permissão do usuário da sessão (RPC `current_user_permissions`). */
export function minhasPermissoes(companyId?: string | null): Promise<string[]> {
  return apiRequest<string[]>(withQuery("/rbac/my-permissions", { company_id: companyId ?? undefined }));
}
