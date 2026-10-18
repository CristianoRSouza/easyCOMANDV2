import { Injectable } from '@nestjs/common';
import { falhaDoBanco } from '../../../common/erros';
import type { UserSupabaseClient } from '../../../db/user-supabase';
import type { MenuItem, SubmenuItem } from '../domain/menus';

type Db = UserSupabaseClient;
type Linha = Record<string, unknown>;
export type Tabela = 'pb_menus' | 'pb_submenus';

/** Consultas de `pb_menus`/`pb_submenus`, as MESMAS de `menus.functions.ts`, com o cliente do usuário. */
@Injectable()
export class MenusRepository {
  async menusESubmenus(db: Db): Promise<{ menus: MenuItem[]; submenus: SubmenuItem[] }> {
    const [menus, submenus] = await Promise.all([
      db
        .from('pb_menus')
        .select('id,name,icon,path,display_order,is_active,company_id,module,required_role,required_permission')
        .order('display_order'),
      db
        .from('pb_submenus')
        .select('id,menu_id,name,path,icon,display_order,is_active,parent_submenu_id,required_role,required_permission')
        .order('display_order'),
    ]);
    if (menus.error) throw falhaDoBanco(menus.error);
    if (submenus.error) throw falhaDoBanco(submenus.error);
    return { menus: (menus.data ?? []) as MenuItem[], submenus: (submenus.data ?? []) as SubmenuItem[] };
  }

  async permissoesAtivas(db: Db): Promise<Array<{ key: string; module_key: string | null; description: string | null }>> {
    const { data, error } = await db
      .from('pv_permissions')
      .select('key,module_key,description')
      .eq('is_active', true)
      .order('key');
    if (error) throw falhaDoBanco(error);
    return (data ?? []) as Array<{ key: string; module_key: string | null; description: string | null }>;
  }

  /** Erro ignorado, como hoje: lista vazia. */
  async modulosAtivos(db: Db): Promise<Array<{ key: string; name: string; description: string | null }>> {
    const { data } = await db.from('pv_modules').select('key,name,description').eq('is_active', true).order('name');
    return (data ?? []) as Array<{ key: string; name: string; description: string | null }>;
  }

  async permissaoExiste(db: Db, chave: string): Promise<boolean> {
    const { data, error } = await db.from('pv_permissions').select('key').eq('key', chave).maybeSingle();
    if (error) throw falhaDoBanco(error);
    return !!data;
  }

  async salvar(db: Db, tabela: Tabela, id: string | undefined, linha: Linha): Promise<Linha> {
    const q = id
      ? db.from(tabela).update(linha as never).eq('id', id).select().single()
      : db.from(tabela).insert(linha as never).select().single();
    const { data, error } = await q;
    if (error) throw falhaDoBanco(error);
    return data as Linha;
  }

  async submenusDoMenu(db: Db, menuId: string): Promise<Array<{ id: string; parent_submenu_id: string | null }>> {
    const { data } = await db.from('pb_submenus').select('id,parent_submenu_id').eq('menu_id', menuId);
    return (data ?? []) as Array<{ id: string; parent_submenu_id: string | null }>;
  }

  async filhosDoSubmenu(db: Db, submenuId: string): Promise<string[]> {
    const { data } = await db.from('pb_submenus').select('id').eq('parent_submenu_id', submenuId);
    return ((data ?? []) as { id: string }[]).map((c) => c.id);
  }

  async excluirSubmenus(db: Db, ids: string[]): Promise<void> {
    if (!ids.length) return;
    const { error } = await db.from('pb_submenus').delete().in('id', ids);
    if (error) throw falhaDoBanco(error);
  }

  async excluir(db: Db, tabela: Tabela, id: string): Promise<void> {
    const { error } = await db.from(tabela).delete().eq('id', id);
    if (error) throw falhaDoBanco(error);
  }

  /** Um UPDATE por linha, em paralelo, e o PRIMEIRO erro vence — como hoje. */
  async reordenar(db: Db, tabela: Tabela, linhas: Array<{ id: string; display_order: number }>): Promise<void> {
    const resultados = await Promise.all(
      linhas.map((r) => db.from(tabela).update({ display_order: r.display_order } as never).eq('id', r.id)),
    );
    const primeiro = resultados.find((r) => r.error)?.error;
    if (primeiro) throw falhaDoBanco(primeiro);
  }
}
