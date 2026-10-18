import { Injectable } from '@nestjs/common';
import type { UserSupabaseClient } from '../../db/user-supabase';
import { proibido } from '../erros';
import { PapeisRepository } from './papeis.repository';
import {
  PERMISSAO_MENUS,
  decisaoPorOverrideDeMenus,
  temCompanyAdmin,
  temPapelLegadoDeAdmin,
  temSystemAdminGlobal,
} from './regras';

export const MSG_REQUER_SYSTEM_ADMIN = 'Permissão negada — requer system_admin.';
export const MSG_REQUER_MENUS = 'Permissão negada — core.menus.manage requerida.';

/**
 * Os gates de administrador do EasyControl, com os MESMOS critérios de hoje. Há DOIS, e a
 * diferença é real:
 *
 *   • `ehAdminLegado` — só `pv_user_roles` (system_admin/tech_admin). É o gate de
 *                       `users.functions.ts` e `events.functions.ts`.
 *   • `ehSystemAdmin` — o legado OU uma atribuição GLOBAL de `system_admin` no RBAC novo. É o
 *                       de `rbac`, `menus` e `user-company-access`.
 *
 * Unificar os dois mudaria quem consegue gerenciar usuários — decisão de produto, não de
 * migração.
 */
@Injectable()
export class AutorizacaoService {
  constructor(private readonly papeis: PapeisRepository) {}

  async ehAdminLegado(db: UserSupabaseClient, userId: string): Promise<boolean> {
    return temPapelLegadoDeAdmin(await this.papeis.papeisLegados(db, userId));
  }

  async ehSystemAdmin(db: UserSupabaseClient, userId: string): Promise<boolean> {
    if (await this.ehAdminLegado(db, userId)) return true;
    return temSystemAdminGlobal(await this.papeis.atribuicoes(db, userId));
  }

  async ehCompanyAdmin(db: UserSupabaseClient, userId: string, companyId: string): Promise<boolean> {
    return temCompanyAdmin(await this.papeis.atribuicoes(db, userId, companyId));
  }

  /** `hasMenusAccess`: system_admin, ou a permissão `core.menus.manage` (override ou role). */
  async temAcessoAosMenus(db: UserSupabaseClient, userId: string): Promise<boolean> {
    if (await this.ehSystemAdmin(db, userId)) return true;
    const porOverride = decisaoPorOverrideDeMenus(await this.papeis.overridesDiretos(db, userId));
    if (porOverride !== null) return porOverride;
    const roleIds = await this.papeis.idsDasRoles(db, userId);
    if (roleIds.length === 0) return false;
    return (await this.papeis.chavesDasPermissoesDasRoles(db, roleIds)).includes(PERMISSAO_MENUS);
  }

  async exigirAdminLegado(db: UserSupabaseClient, userId: string): Promise<void> {
    if (!(await this.ehAdminLegado(db, userId))) throw proibido(MSG_REQUER_SYSTEM_ADMIN);
  }

  /** `mensagem`: o RBAC de hoje diz só "Permissão negada"; o de vínculos, "…requer system_admin." */
  async exigirSystemAdmin(db: UserSupabaseClient, userId: string, mensagem = MSG_REQUER_SYSTEM_ADMIN): Promise<void> {
    if (!(await this.ehSystemAdmin(db, userId))) throw proibido(mensagem);
  }

  async exigirAcessoAosMenus(db: UserSupabaseClient, userId: string): Promise<void> {
    if (!(await this.temAcessoAosMenus(db, userId))) throw proibido(MSG_REQUER_MENUS);
  }
}
