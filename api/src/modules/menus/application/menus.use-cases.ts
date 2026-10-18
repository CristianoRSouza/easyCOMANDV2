import { Injectable } from '@nestjs/common';
import { AuditoriaRbac } from '../../../common/auditoria/auditoria-rbac';
import { AutorizacaoService } from '../../../common/autorizacao';
import { invalido } from '../../../common/erros';
import type { UserSupabaseClient } from '../../../db/user-supabase';
import {
  msgPermissaoInexistente,
  normalizarPermissaoExigida,
  ordemDeExclusao,
  papelExigido,
  type MenuItem,
  type ModuleOption,
  type SubmenuItem,
} from '../domain/menus';
import { MenusRepository } from '../infrastructure/menus.repository';

type Db = UserSupabaseClient;
type Ordem = Array<{ id: string; display_order: number }>;

export type DadosDoMenu = {
  name: string;
  icon?: string | null;
  path?: string | null;
  module: string;
  display_order: number;
  is_active: boolean;
  required_role?: string | null;
  required_permission?: string | null;
  company_id?: string | null;
};

export type DadosDoSubmenu = {
  menu_id: string;
  name: string;
  path: string;
  icon?: string | null;
  display_order: number;
  is_active: boolean;
  parent_submenu_id?: string | null;
  required_role?: string | null;
  required_permission?: string | null;
};

/**
 * `manageMenus` de hoje. Leituras SEM gate (RLS); toda escrita exige `core.menus.manage`
 * (system_admin ou a permissão, ver AutorizacaoService.temAcessoAosMenus).
 */
@Injectable()
export class MenusService {
  constructor(
    private readonly autorizacao: AutorizacaoService,
    private readonly repo: MenusRepository,
    private readonly auditoria: AuditoriaRbac,
  ) {}

  async acesso(db: Db, ator: string): Promise<{ allowed: boolean }> {
    return { allowed: await this.autorizacao.temAcessoAosMenus(db, ator) };
  }

  listar(db: Db): Promise<{ menus: MenuItem[]; submenus: SubmenuItem[] }> {
    return this.repo.menusESubmenus(db);
  }

  permissoes(db: Db) {
    return this.repo.permissoesAtivas(db);
  }

  async modulos(db: Db): Promise<ModuleOption[]> {
    return (await this.repo.modulosAtivos(db)).map((m) => ({
      value: m.key,
      label: m.name,
      description: m.description ?? undefined,
    }));
  }

  private async permissaoValida(db: Db, chave: string | null | undefined): Promise<string | null> {
    const normalizada = normalizarPermissaoExigida(chave);
    if (normalizada && !(await this.repo.permissaoExiste(db, normalizada))) {
      throw invalido(msgPermissaoInexistente(normalizada));
    }
    return normalizada;
  }

  async salvarMenu(db: Db, ator: string, id: string | undefined, m: DadosDoMenu): Promise<Record<string, unknown>> {
    await this.autorizacao.exigirAcessoAosMenus(db, ator);
    const required_permission = await this.permissaoValida(db, m.required_permission);
    const linha = {
      name: m.name,
      icon: m.icon ?? null,
      path: m.path ?? null,
      module: m.module,
      display_order: m.display_order,
      is_active: m.is_active,
      required_role: papelExigido(m.required_role),
      required_permission,
      company_id: m.company_id ?? null,
    };
    const salvo = await this.repo.salvar(db, 'pb_menus', id, linha);
    await this.auditoria.registrar(db, {
      actor_id: ator,
      action: 'menu.upsert',
      entity: 'pb_menus',
      entity_id: id ?? String(salvo.id),
      payload: linha,
    });
    return salvo;
  }

  async excluirMenu(db: Db, ator: string, id: string): Promise<{ ok: true }> {
    await this.autorizacao.exigirAcessoAosMenus(db, ator);
    const subs = await this.repo.submenusDoMenu(db, id);
    const { filhos, raizes } = ordemDeExclusao(subs);
    await this.repo.excluirSubmenus(db, filhos);
    await this.repo.excluirSubmenus(db, raizes);
    await this.repo.excluir(db, 'pb_menus', id);
    await this.auditoria.registrar(db, {
      actor_id: ator,
      action: 'menu.delete',
      entity: 'pb_menus',
      entity_id: id,
      payload: { deleted_submenus: subs.length },
    });
    return { ok: true };
  }

  async reordenarMenus(db: Db, ator: string, linhas: Ordem): Promise<{ ok: true }> {
    await this.autorizacao.exigirAcessoAosMenus(db, ator);
    await this.repo.reordenar(db, 'pb_menus', linhas);
    await this.auditoria.registrar(db, {
      actor_id: ator,
      action: 'menu.reorder',
      entity: 'pb_menus',
      entity_id: null,
      payload: { count: linhas.length },
    });
    return { ok: true };
  }

  async salvarSubmenu(db: Db, ator: string, id: string | undefined, s: DadosDoSubmenu): Promise<Record<string, unknown>> {
    await this.autorizacao.exigirAcessoAosMenus(db, ator);
    const required_permission = await this.permissaoValida(db, s.required_permission);
    const linha = {
      menu_id: s.menu_id,
      name: s.name,
      path: s.path,
      icon: s.icon ?? null,
      display_order: s.display_order,
      is_active: s.is_active,
      parent_submenu_id: s.parent_submenu_id ?? null,
      required_role: papelExigido(s.required_role),
      required_permission,
    };
    const salvo = await this.repo.salvar(db, 'pb_submenus', id, linha);
    await this.auditoria.registrar(db, {
      actor_id: ator,
      action: 'submenu.upsert',
      entity: 'pb_submenus',
      entity_id: id ?? String(salvo.id),
      payload: linha,
    });
    return salvo;
  }

  async excluirSubmenu(db: Db, ator: string, id: string): Promise<{ ok: true }> {
    await this.autorizacao.exigirAcessoAosMenus(db, ator);
    const filhos = await this.repo.filhosDoSubmenu(db, id);
    await this.repo.excluirSubmenus(db, filhos);
    await this.repo.excluir(db, 'pb_submenus', id);
    await this.auditoria.registrar(db, {
      actor_id: ator,
      action: 'submenu.delete',
      entity: 'pb_submenus',
      entity_id: id,
      payload: { deleted_children: filhos.length },
    });
    return { ok: true };
  }

  async reordenarSubmenus(db: Db, ator: string, menuId: string, linhas: Ordem): Promise<{ ok: true }> {
    await this.autorizacao.exigirAcessoAosMenus(db, ator);
    await this.repo.reordenar(db, 'pb_submenus', linhas);
    await this.auditoria.registrar(db, {
      actor_id: ator,
      action: 'submenu.reorder',
      entity: 'pb_submenus',
      entity_id: menuId,
      payload: { count: linhas.length },
    });
    return { ok: true };
  }
}
