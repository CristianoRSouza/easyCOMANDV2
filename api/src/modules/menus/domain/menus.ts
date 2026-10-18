import { invalido } from '../../../common/erros';

/** Tipos e regras puras dos menus — `easyCONTROL/src/lib/menus/{types,menus.functions}.ts`. */

export type AppRole = 'system_admin' | 'company_admin' | 'user' | 'tech_admin' | 'tech_user';

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

export const MENU_PERMISSION_REGEX = /^[a-z0-9_]+(\.[a-z0-9_]+)+$/;

/** "Todos" na tela é `all`; no banco, ausência de exigência é `null`. */
export function papelExigido(papel: string | null | undefined): string | null {
  return papel && papel !== 'all' ? papel : null;
}

/**
 * Permissão exigida: vazia → `null`; senão aparada e no formato `modulo.recurso.acao`. Se o
 * formato passar, quem confere se a permissão EXISTE é o caso de uso (ida ao banco).
 */
export function normalizarPermissaoExigida(chave: string | null | undefined): string | null {
  if (!chave || !chave.trim()) return null;
  const aparada = chave.trim();
  if (!MENU_PERMISSION_REGEX.test(aparada)) {
    throw invalido("Formato inválido — use 'modulo.recurso.acao' (apenas letras minúsculas, números e underscores).");
  }
  return aparada;
}

export const msgPermissaoInexistente = (chave: string) =>
  `Permissão "${chave}" inexistente — crie em /rbac → Permissões antes de usá-la aqui.`;

/**
 * Ordem de exclusão dos submenus de um menu: os NETOS (que têm pai) antes das raízes — a FK não
 * tem cascade.
 */
export function ordemDeExclusao(subs: Array<{ id: string; parent_submenu_id: string | null }>): {
  filhos: string[];
  raizes: string[];
} {
  return {
    filhos: subs.filter((s) => s.parent_submenu_id !== null).map((s) => s.id),
    raizes: subs.filter((s) => s.parent_submenu_id === null).map((s) => s.id),
  };
}
