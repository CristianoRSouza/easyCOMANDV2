/**
 * Regras PURAS de quem é administrador — as mesmas que hoje vivem copiadas, com variações, no
 * topo de cada `*.functions.ts` do EasyControl. Aqui ficam escritas uma vez, e cada variação
 * tem nome próprio: não são "a mesma regra"; trocar uma pela outra muda quem entra.
 */

/** Papéis legados (`pv_user_roles.role`) que abrem o Control Center. */
const PAPEIS_ADMIN = new Set(['system_admin', 'tech_admin']);

export type AtribuicaoComPapel = { company_id: string | null; role_key: string | null };
export type OverrideDePermissao = { effect: string; permission_key: string | null };

/** `pv_user_roles` tem `system_admin` ou `tech_admin`? */
export function temPapelLegadoDeAdmin(papeis: string[]): boolean {
  return papeis.some((p) => PAPEIS_ADMIN.has(p));
}

/** Papel do login: `system_admin` vence `tech_admin`; nenhum dos dois → `false`. */
export function papelDoAdmin(papeis: string[]): 'system_admin' | 'tech_admin' | false {
  if (papeis.includes('system_admin')) return 'system_admin';
  if (papeis.includes('tech_admin')) return 'tech_admin';
  return false;
}

/** RBAC novo: atribuição de `system_admin` SEM empresa (global). */
export function temSystemAdminGlobal(atribuicoes: AtribuicaoComPapel[]): boolean {
  return atribuicoes.some((a) => a.role_key === 'system_admin' && !a.company_id);
}

/** RBAC novo: `company_admin` naquela empresa (as atribuições já vêm filtradas por ela). */
export function temCompanyAdmin(atribuicoesDaEmpresa: AtribuicaoComPapel[]): boolean {
  return atribuicoesDaEmpresa.some((a) => a.role_key === 'company_admin');
}

export const PERMISSAO_MENUS = 'core.menus.manage';

/**
 * Override direto da permissão de menus: `deny` vence; depois, um `allow` libera; senão,
 * `null` (decide pelas roles).
 *
 * ⚠️ DEFEITO PRESERVADO: o enum de `pv_user_permissions.effect` é `grant`/`deny` — `allow`
 * nunca existe, então um override de GRANT direto não libera os menus hoje (só o de DENY tem
 * efeito). Mantido igual para não mudar quem acessa; registrado em docs/decisoes-pendentes.md.
 */
export function decisaoPorOverrideDeMenus(overrides: OverrideDePermissao[]): boolean | null {
  const daPermissao = overrides.filter((o) => o.permission_key === PERMISSAO_MENUS);
  if (daPermissao.some((o) => o.effect === 'deny')) return false;
  if (daPermissao.some((o) => o.effect === 'allow')) return true;
  return null;
}
