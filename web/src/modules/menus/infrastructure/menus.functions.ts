import { apiRequest } from "@/shared/http/api-client";
import type { ChamadaComData } from "@/shared/http/server-fn";

/**
 * As ações do `manageMenus` de hoje (`easyCONTROL/src/lib/menus/menus.functions.ts`), com o MESMO
 * contrato de entrada, traduzidas nas rotas REST da API.
 */
type Ordem = { id: string; display_order: number };

export type MenusAction =
  | { action: "list_menus" }
  | { action: "list_permissions" }
  | { action: "list_modules" }
  | { action: "check_access" }
  | {
      action: "upsert_menu";
      id?: string;
      name: string;
      icon?: string | null;
      path?: string | null;
      module: string;
      display_order?: number;
      is_active?: boolean;
      required_role?: string | null;
      required_permission?: string | null;
      company_id?: string | null;
    }
  | { action: "delete_menu"; id: string }
  | { action: "reorder_menus"; rows: Ordem[] }
  | {
      action: "upsert_submenu";
      id?: string;
      menu_id: string;
      name: string;
      path: string;
      icon?: string | null;
      display_order?: number;
      is_active?: boolean;
      parent_submenu_id?: string | null;
      required_role?: string | null;
      required_permission?: string | null;
    }
  | { action: "delete_submenu"; id: string }
  | { action: "reorder_submenus"; menu_id: string; rows: Ordem[] };

const enc = encodeURIComponent;

export async function despacharMenus(input: MenusAction): Promise<unknown> {
  switch (input.action) {
    case "list_menus":
      return apiRequest("/menus");
    case "list_permissions":
      return apiRequest("/menus/permissions");
    case "list_modules":
      return apiRequest("/menus/modules");
    case "check_access":
      return apiRequest("/menus/access");
    case "upsert_menu": {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { id, action: _a, ...corpo } = input;
      return id ? apiRequest(`/menus/${enc(id)}`, { method: "PUT", body: corpo }) : apiRequest("/menus", { method: "POST", body: corpo });
    }
    case "delete_menu":
      return apiRequest(`/menus/${enc(input.id)}`, { method: "DELETE" });
    case "reorder_menus":
      return apiRequest("/menus/reorder", { method: "POST", body: { rows: input.rows } });
    case "upsert_submenu": {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { id, action: _a, ...corpo } = input;
      return id
        ? apiRequest(`/menus/submenus/${enc(id)}`, { method: "PUT", body: corpo })
        : apiRequest("/menus/submenus", { method: "POST", body: corpo });
    }
    case "delete_submenu":
      return apiRequest(`/menus/submenus/${enc(input.id)}`, { method: "DELETE" });
    case "reorder_submenus":
      return apiRequest(`/menus/${enc(input.menu_id)}/submenus/reorder`, { method: "POST", body: { rows: input.rows } });
  }
}

/** Mesma assinatura da server function de hoje (`manageMenus({ data })`). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const manageMenus = ({ data }: ChamadaComData<MenusAction>): Promise<any> => despacharMenus(data);
