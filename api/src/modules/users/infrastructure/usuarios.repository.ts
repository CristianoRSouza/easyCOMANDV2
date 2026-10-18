import { Injectable } from '@nestjs/common';
import { ErroDeRegra, falhaDoBanco, naoEncontrado } from '../../../common/erros';
import type { UserSupabaseClient } from '../../../db/user-supabase';
import { ServiceRole } from '../../../db/service-role';
import { descreverErroDaLista, type PapelLinha, type PerfilLinha } from '../domain/usuarios';

/**
 * Consultas da tela "Usuários", as MESMAS de `users.functions.ts`, com o cliente do usuário
 * (RLS) — exceto a exclusão definitiva, que exige a service_role (ver `excluirDeVez`).
 */
@Injectable()
export class UsuariosRepository {
  constructor(private readonly serviceRole: ServiceRole) {}

  async listarPerfis(
    db: UserSupabaseClient,
    janela: { from: number; to: number },
    filtro: string | null,
  ): Promise<{ perfis: PerfilLinha[]; total: number | null }> {
    let q = db
      .from('pb_profiles')
      .select('id,email,full_name,created_at,is_active', { count: 'estimated' })
      .order('created_at', { ascending: false });
    if (filtro) q = q.or(filtro);
    const { data, error, count } = await q.range(janela.from, janela.to);
    if (error) throw new ErroDeRegra(descreverErroDaLista(error), 'banco');
    return { perfis: (data ?? []) as PerfilLinha[], total: count };
  }

  /** Erro aqui é ignorado, como hoje: a lista sai sem papel em vez de falhar. */
  async papeisDe(db: UserSupabaseClient, ids: string[]): Promise<PapelLinha[]> {
    if (!ids.length) return [];
    const { data } = await db.from('pv_user_roles').select('user_id,role').in('user_id', ids);
    return (data ?? []) as PapelLinha[];
  }

  /** Papel atual (o primeiro lido) — o `from_role` da auditoria. */
  async papelAtual(db: UserSupabaseClient, userId: string): Promise<string | null> {
    const { data } = await db.from('pv_user_roles').select('role').eq('user_id', userId);
    return ((data ?? []) as { role: string }[])[0]?.role ?? null;
  }

  /** `setRole` de hoje: apaga TODOS os papéis do usuário e grava o novo (sem transação, como hoje). */
  async trocarPapel(db: UserSupabaseClient, userId: string, papel: 'system_admin' | 'user'): Promise<void> {
    const apagar = await db.from('pv_user_roles').delete().eq('user_id', userId);
    if (apagar.error) throw falhaDoBanco(apagar.error);
    const inserir = await db.from('pv_user_roles').insert({ user_id: userId, role: papel } as never);
    if (inserir.error) throw falhaDoBanco(inserir.error);
  }

  async definirAtivo(db: UserSupabaseClient, userId: string, ativo: boolean): Promise<void> {
    const { data, error } = await db
      .from('pb_profiles')
      .update({ is_active: ativo } as never)
      .eq('id', userId)
      .select('id');
    if (error) throw falhaDoBanco(error);
    if (!data || data.length === 0) throw naoEncontrado('Usuário não encontrado.');
  }

  /**
   * Exclusão definitiva: `auth.admin.deleteUser` e a limpeza de `pv_user_roles`/`pb_profiles`,
   * na MESMA ordem de hoje e parando no primeiro erro. Só a service_role apaga do Auth.
   */
  async excluirDeVez(userId: string): Promise<void> {
    await this.serviceRole.run('usuario-exclusao', async (admin) => {
      const auth = await admin.auth.admin.deleteUser(userId);
      if (auth.error) throw new ErroDeRegra(auth.error.message, 'banco');
      const papeis = await admin.from('pv_user_roles').delete().eq('user_id', userId);
      if (papeis.error) throw falhaDoBanco(papeis.error);
      const perfil = await admin.from('pb_profiles').delete().eq('id', userId);
      if (perfil.error) throw falhaDoBanco(perfil.error);
    });
  }
}
