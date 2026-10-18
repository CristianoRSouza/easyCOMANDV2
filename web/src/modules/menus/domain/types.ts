export type AppRole = "system_admin" | "company_admin" | "user" | "tech_admin" | "tech_user";

export interface MenuItem {
  id: string;
  name: string;
  icon: string | null;
  path: string | null;
  display_order: number;
  is_active: boolean;
  company_id: string | null;
  module: string;
  required_role: AppRole | null;
  required_permission: string | null;
}

export interface SubmenuItem {
  id: string;
  menu_id: string;
  name: string;
  path: string;
  icon: string | null;
  display_order: number;
  is_active: boolean;
  parent_submenu_id: string | null;
  required_role: AppRole | null;
  required_permission: string | null;
}

export interface ModuleOption {
  value: string;
  label: string;
  description?: string;
}

export const AVAILABLE_ROLES: { value: AppRole; label: string; description: string }[] = [
  { value: "system_admin", label: "System Admin", description: "Apenas administradores globais do sistema" },
  { value: "tech_admin", label: "Tech Admin", description: "Equivalente a System Admin — acesso global" },
  { value: "company_admin", label: "Company Admin", description: "Administradores da empresa e acima" },
  { value: "user", label: "Usuário", description: "Qualquer usuário autenticado com acesso" },
  { value: "tech_user", label: "Tech User", description: "Equivalente a Usuário comum" },
];

export const MENU_PERMISSION_REGEX = /^[a-z0-9_]+(\.[a-z0-9_]+)+$/;