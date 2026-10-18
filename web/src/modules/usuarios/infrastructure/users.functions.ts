import { apiRequest, withQuery } from "@/shared/http/api-client";
import type { ChamadaComData } from "@/shared/http/server-fn";

/** Linha da tela "Usuários & Roles" — o `UserRow` de hoje. */
export interface UserRow {
  id: string;
  email: string | null;
  full_name: string | null;
  role: "system_admin" | "tech_admin" | "company_admin" | "user" | null;
  created_at: string | null;
  is_active: boolean;
}

/** As ações do `manageUsers` de hoje (`easyCONTROL/src/lib/users/users.functions.ts`). */
export type ManageUsersAction =
  | { action: "list"; page?: number; pageSize?: number; query?: string }
  | { action: "promote"; user_id: string }
  | { action: "demote"; user_id: string }
  | { action: "set_active"; user_id: string; is_active: boolean }
  | { action: "delete"; user_id: string };

const enc = encodeURIComponent;

export async function despacharUsuarios(input: ManageUsersAction): Promise<unknown> {
  switch (input.action) {
    case "list":
      return apiRequest(withQuery("/users", { page: input.page, pageSize: input.pageSize, query: input.query }));
    case "promote":
      return apiRequest(`/users/${enc(input.user_id)}/promote`, { method: "POST" });
    case "demote":
      return apiRequest(`/users/${enc(input.user_id)}/demote`, { method: "POST" });
    case "set_active":
      return apiRequest(`/users/${enc(input.user_id)}/active`, { method: "PATCH", body: { is_active: input.is_active } });
    case "delete":
      return apiRequest(`/users/${enc(input.user_id)}`, { method: "DELETE" });
  }
}

/** Mesma assinatura da server function de hoje (`manageUsers({ data })`). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const manageUsers = ({ data }: ChamadaComData<ManageUsersAction>): Promise<any> => despacharUsuarios(data);
