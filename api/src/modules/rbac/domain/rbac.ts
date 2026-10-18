import { invalido, naoEncontrado, proibido } from '../../../common/erros';

/**
 * Tipos e regras puras do RBAC — `easyCONTROL/src/lib/rbac/{types,rbac.functions}.ts`.
 * Os formatos de saída são os MESMOS de hoje: a tela lê campo a campo.
 */

export type RbacScope = 'global' | 'company' | 'store';
export type OverrideEffect = 'grant' | 'deny';

export interface RbacModule {
  id: string;
  key: string;
  name: string;
  description: string | null;
  version: string;
  is_active: boolean;
  permission_count?: number;
}

export interface RbacPermission {
  id: string;
  key: string;
  module_key: string | null;
  scope: RbacScope;
  description: string | null;
  is_active: boolean;
  role_count?: number;
}

export interface RbacRole {
  id: string;
  key: string;
  name: string;
  description: string | null;
  scope: RbacScope;
  is_system: boolean;
  permission_ids: string[];
  permission_keys: string[];
}

export interface RbacAssignment {
  id: string;
  user_id: string;
  role_id: string;
  company_id: string | null;
  store_id: string | null;
  created_at: string;
  role: { id: string; key: string; name: string; scope: RbacScope };
  user: { id: string; email: string | null; full_name: string | null };
  company?: { id: string; name: string | null } | null;
  store?: { id: string; trade_name: string | null } | null;
}

export interface RbacOverride {
  id: string;
  user_id: string;
  permission_id: string;
  company_id: string | null;
  store_id: string | null;
  effect: OverrideEffect;
  permission: { id: string; key: string; scope: RbacScope };
}

export interface RbacAuditEntry {
  id: string;
  actor_id: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
  payload: unknown;
  created_at: string;
  actor?: { email: string | null; full_name: string | null } | null;
}

/** `module.action` ou `module.*` ou `*` — mesma regex de hoje. */
export const PERMISSION_KEY_REGEX = /^[a-z0-9_]+(\.[a-z0-9_*]+)+$|^\*$/;

/** Quantas vezes cada chave aparece (contagem de permissões por módulo, de roles por permissão). */
export function contar(chaves: Array<string | null>): Map<string, number> {
  const m = new Map<string, number>();
  for (const k of chaves) {
    if (!k) continue;
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return m;
}

/** Ids e chaves das permissões de cada role, na ordem em que o PostgREST devolve. */
export function permissoesPorRole(
  linhas: Array<{ role_id: string; permission_id: string; key: string }>,
): Map<string, { ids: string[]; keys: string[] }> {
  const m = new Map<string, { ids: string[]; keys: string[] }>();
  for (const r of linhas) {
    const e = m.get(r.role_id) ?? { ids: [], keys: [] };
    e.ids.push(r.permission_id);
    e.keys.push(r.key);
    m.set(r.role_id, e);
  }
  return m;
}

export const msgModuloDuplicado = (key: string) => `Já existe um módulo com a chave "${key}".`;

/** Role de sistema: key e name congelados (description/scope/permissões continuam editáveis). */
export function conferirEdicaoDeRoleDeSistema(
  atual: { key: string; name: string; is_system: boolean } | null,
  nova: { key: string; name: string },
): void {
  if (atual?.is_system && (atual.key !== nova.key || atual.name !== nova.name)) {
    throw invalido('Roles de sistema não podem ter key ou name alterados.');
  }
}

export function conferirExclusaoDeRole(atual: { is_system: boolean } | null): void {
  if (atual?.is_system) throw invalido('Roles de sistema não podem ser excluídas.');
}

export function conferirExclusaoDePermissao(vinculosExistentes: number): void {
  if (vinculosExistentes > 0) {
    throw invalido('Permissão está vinculada a uma ou mais roles. Remova os vínculos antes de excluir.');
  }
}

/**
 * Quem pode ATRIBUIR uma role — `assign_role` de hoje:
 *   • system_admin: qualquer uma;
 *   • senão: nunca global, e só na empresa em que é company_admin.
 * Depois (para todos): role não-global exige empresa.
 *
 * `ehCompanyAdminDaEmpresa` só é chamado quando precisa (a consulta custa uma ida ao banco).
 */
export async function conferirAtribuicao(
  role: { scope: RbacScope } | null,
  companyId: string | null,
  ehSystemAdmin: boolean,
  ehCompanyAdminDaEmpresa: (companyId: string) => Promise<boolean>,
): Promise<void> {
  if (!role) throw naoEncontrado('Role inexistente');
  if (!ehSystemAdmin) {
    if (role.scope === 'global') throw proibido('Apenas system_admin pode atribuir roles globais.');
    if (!companyId || !(await ehCompanyAdminDaEmpresa(companyId))) {
      throw proibido('Você só pode atribuir roles na sua empresa.');
    }
  }
  if (role.scope !== 'global' && !companyId) {
    throw invalido('Empresa é obrigatória para roles de escopo company/store.');
  }
}

/**
 * Quem pode MEXER numa atribuição/override existente (revogar, criar override, apagar override):
 * system_admin, ou company_admin da empresa da linha. Role global só o system_admin.
 * Mensagem genérica "Permissão negada", como hoje.
 */
export async function conferirGestaoNaEmpresa(
  companyId: string | null,
  ehSystemAdmin: boolean,
  ehCompanyAdminDaEmpresa: (companyId: string) => Promise<boolean>,
  roleGlobal = false,
): Promise<void> {
  if (ehSystemAdmin) return;
  if (roleGlobal) throw proibido();
  if (!companyId || !(await ehCompanyAdminDaEmpresa(companyId))) throw proibido();
}
