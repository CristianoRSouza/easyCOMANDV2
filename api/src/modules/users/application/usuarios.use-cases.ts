import { Injectable } from '@nestjs/common';
import { AuditoriaRbac } from '../../../common/auditoria/auditoria-rbac';
import { AutorizacaoService } from '../../../common/autorizacao';
import type { UserSupabaseClient } from '../../../db/user-supabase';
import { filtroEmailOuNome, janela } from '../../../common/consulta';
import {
  montarLinhas,
  naoPodeDesativarASiMesmo,
  naoPodeExcluirASiMesmo,
  naoPodeRebaixarASiMesmo,
  type UserRow,
} from '../domain/usuarios';
import { UsuariosRepository } from '../infrastructure/usuarios.repository';

export type ConsultaDeUsuarios = { page: number; pageSize: number; query?: string };

/**
 * `manageUsers` de hoje, uma ação por método. TODAS começam pelo gate LEGADO
 * (`pv_user_roles` system_admin/tech_admin) — é o `requireSystemAdmin` deste arquivo, que NÃO
 * olha o RBAC novo (ver AutorizacaoService).
 */
@Injectable()
export class UsuariosService {
  constructor(
    private readonly autorizacao: AutorizacaoService,
    private readonly repo: UsuariosRepository,
    private readonly auditoria: AuditoriaRbac,
  ) {}

  async listar(db: UserSupabaseClient, ator: string, c: ConsultaDeUsuarios): Promise<{ rows: UserRow[]; total: number }> {
    await this.autorizacao.exigirAdminLegado(db, ator);
    const { perfis, total } = await this.repo.listarPerfis(db, janela(c.page, c.pageSize), filtroEmailOuNome(c.query));
    const papeis = await this.repo.papeisDe(
      db,
      perfis.map((p) => p.id),
    );
    const rows = montarLinhas(perfis, papeis);
    return { rows, total: total ?? rows.length };
  }

  async promover(db: UserSupabaseClient, ator: string, alvo: string): Promise<{ ok: true }> {
    await this.autorizacao.exigirAdminLegado(db, ator);
    const from_role = await this.repo.papelAtual(db, alvo);
    await this.repo.trocarPapel(db, alvo, 'system_admin');
    await this.auditoria.registrar(db, {
      actor_id: ator,
      action: 'role_grant',
      entity: 'pv_user_roles',
      entity_id: alvo,
      payload: { from_role, to_role: 'system_admin' },
    });
    return { ok: true };
  }

  async rebaixar(db: UserSupabaseClient, ator: string, alvo: string): Promise<{ ok: true }> {
    await this.autorizacao.exigirAdminLegado(db, ator);
    naoPodeRebaixarASiMesmo(alvo, ator);
    const from_role = await this.repo.papelAtual(db, alvo);
    await this.repo.trocarPapel(db, alvo, 'user');
    await this.auditoria.registrar(db, {
      actor_id: ator,
      action: 'role_revoke',
      entity: 'pv_user_roles',
      entity_id: alvo,
      payload: { from_role, to_role: 'user' },
    });
    return { ok: true };
  }

  async definirAtivo(db: UserSupabaseClient, ator: string, alvo: string, ativo: boolean): Promise<{ ok: true }> {
    await this.autorizacao.exigirAdminLegado(db, ator);
    naoPodeDesativarASiMesmo(alvo, ator, ativo);
    await this.repo.definirAtivo(db, alvo, ativo);
    await this.auditoria.registrar(db, {
      actor_id: ator,
      action: ativo ? 'user_activate' : 'user_deactivate',
      entity: 'pb_profiles',
      entity_id: alvo,
      payload: { is_active: ativo },
    });
    return { ok: true };
  }

  async excluir(db: UserSupabaseClient, ator: string, alvo: string): Promise<{ ok: true }> {
    await this.autorizacao.exigirAdminLegado(db, ator);
    naoPodeExcluirASiMesmo(alvo, ator);
    await this.repo.excluirDeVez(alvo);
    await this.auditoria.registrar(db, {
      actor_id: ator,
      action: 'user_delete',
      entity: 'auth.users',
      entity_id: alvo,
      payload: {},
    });
    return { ok: true };
  }
}
