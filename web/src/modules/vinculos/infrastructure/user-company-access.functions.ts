import { apiRequest, withQuery } from "@/shared/http/api-client";
import type { ChamadaComData } from "@/shared/http/server-fn";

type Status = "pending" | "approved" | "rejected";

/** Linha da tela de vínculos — o `UcaRow` de hoje. */
export interface UcaRow {
  id: string;
  user_id: string;
  company_id: string;
  status: Status;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  user_email: string | null;
  user_full_name: string | null;
  company_name: string | null;
}

/** As ações do `manageUserCompanyAccess` de hoje. */
export type UserCompanyAccessAction =
  | { action: "list"; page?: number; pageSize?: number; status?: Status | "all"; company_id?: string; user_query?: string }
  | { action: "list_companies" }
  | { action: "list_users"; query?: string }
  | { action: "create"; user_id: string; company_id: string; status?: Status }
  | { action: "update_status"; id: string; status: Status }
  | { action: "delete"; id: string };

const enc = encodeURIComponent;

export async function despacharVinculos(input: UserCompanyAccessAction): Promise<unknown> {
  switch (input.action) {
    case "list":
      return apiRequest(
        withQuery("/user-company-access", {
          page: input.page,
          pageSize: input.pageSize,
          status: input.status,
          company_id: input.company_id,
          user_query: input.user_query,
        }),
      );
    case "list_companies":
      return apiRequest("/user-company-access/companies");
    case "list_users":
      return apiRequest(withQuery("/user-company-access/users", { query: input.query ?? "" }));
    case "create":
      return apiRequest("/user-company-access", {
        method: "POST",
        body: { user_id: input.user_id, company_id: input.company_id, status: input.status },
      });
    case "update_status":
      return apiRequest(`/user-company-access/${enc(input.id)}`, { method: "PATCH", body: { status: input.status } });
    case "delete":
      return apiRequest(`/user-company-access/${enc(input.id)}`, { method: "DELETE" });
  }
}

/** Mesma assinatura da server function de hoje (`manageUserCompanyAccess({ data })`). */
export const manageUserCompanyAccess = ({ data }: ChamadaComData<UserCompanyAccessAction>): Promise<any> => // eslint-disable-line @typescript-eslint/no-explicit-any
  despacharVinculos(data);
