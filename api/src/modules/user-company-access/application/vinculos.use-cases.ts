import { Injectable } from '@nestjs/common';
import { AuditoriaRbac } from '../../../common/auditoria/auditoria-rbac';
import { AutorizacaoService } from '../../../common/autorizacao';
import { filtroEmailOuNome, janela } from '../../../common/consulta';
import type { UserSupabaseClient } from '../../../db/user-supabase';
import {
  aprovacaoNaCriacao,
  aprovacaoNaTroca,
  distintos,
  enriquecer,
  operacaoDaTroca,
  type EmpresaResumo,
  type PerfilResumo,
  type StatusDoVinculo,
  type UcaRow,
} from '../domain/vinculos';
import { VinculosRepository } from '../infrastructure/vinculos.repository';

export type ConsultaDeVinculos = {
  page: number;
  pageSize: number;
  status: StatusDoVinculo | 'all';
  company_id?: string;
  user_query?: string;
};

/**
 * `manageUserCompanyAccess` de hoje, uma ação por método. TODAS começam pelo gate
 * `ehSystemAdmin` (legado OU system_admin global do RBAC novo).
 */
@Injectable()
export class VinculosService {
  constructor(
    private readonly autorizacao: AutorizacaoService,
    private readonly repo: VinculosRepository,
    private readonly auditoria: AuditoriaRbac,
  ) {}

  async listar(db: UserSupabaseClient, ator: string, c: ConsultaDeVinculos): Promise<{ rows: UcaRow[]; total: number }> {
    await this.autorizacao.exigirSystemAdmin(db, ator);

    // Pré-filtro por usuário: busca sem nenhum perfil casando → lista vazia, sem consultar os vínculos.
    let userIds: string[] | null = null;
    const filtro = filtroEmailOuNome(c.user_query);
    if (filtro) {
      userIds = await this.repo.idsDosPerfisQueCasam(db, filtro);
      if (userIds.length === 0) return { rows: [], total: 0 };
    }

    const { linhas, total } = await this.repo.listar(db, janela(c.page, c.pageSize), {
      status: c.status,
      company_id: c.company_id,
      user_ids: userIds,
    });
    const [perfis, empresas] = await Promise.all([
      this.repo.perfis(db, distintos(linhas.map((r) => r.user_id))),
      this.repo.empresas(db, distintos(linhas.map((r) => r.company_id))),
    ]);
    const rows = enriquecer(linhas, perfis, empresas);
    return { rows, total: total ?? rows.length };
  }

  async empresas(db: UserSupabaseClient, ator: string): Promise<EmpresaResumo[]> {
    await this.autorizacao.exigirSystemAdmin(db, ator);
    return this.repo.todasAsEmpresas(db);
  }

  async usuarios(db: UserSupabaseClient, ator: string, termo: string): Promise<PerfilResumo[]> {
    await this.autorizacao.exigirSystemAdmin(db, ator);
    return this.repo.buscarUsuarios(db, filtroEmailOuNome(termo));
  }

  async criar(
    db: UserSupabaseClient,
    ator: string,
    dados: { user_id: string; company_id: string; status: StatusDoVinculo },
  ): Promise<Record<string, unknown>> {
    await this.autorizacao.exigirSystemAdmin(db, ator);
    const criado = await this.repo.criar(db, { ...dados, ...aprovacaoNaCriacao(dados.status, ator, new Date()) });
    await this.auditoria.registrar(db, {
      actor_id: ator,
      action: 'user_company_access_change',
      entity: 'user_company_access',
      entity_id: String(criado.id),
      payload: { op: 'create', user_id: dados.user_id, company_id: dados.company_id, status: dados.status },
    });
    return criado;
  }

  async trocarStatus(db: UserSupabaseClient, ator: string, id: string, status: StatusDoVinculo): Promise<{ ok: true }> {
    await this.autorizacao.exigirSystemAdmin(db, ator);
    const linha = await this.repo.atualizar(db, id, { status, ...aprovacaoNaTroca(status, ator, new Date()) });
    await this.auditoria.registrar(db, {
      actor_id: ator,
      action: 'user_company_access_change',
      entity: 'user_company_access',
      entity_id: id,
      payload: { op: operacaoDaTroca(status), user_id: linha.user_id, company_id: linha.company_id, status },
    });
    return { ok: true };
  }

  async excluir(db: UserSupabaseClient, ator: string, id: string): Promise<{ ok: true }> {
    await this.autorizacao.exigirSystemAdmin(db, ator);
    const dono = await this.repo.donoDoVinculo(db, id);
    await this.repo.excluir(db, id);
    await this.auditoria.registrar(db, {
      actor_id: ator,
      action: 'user_company_access_change',
      entity: 'user_company_access',
      entity_id: id,
      payload: { op: 'remove', user_id: dono?.user_id ?? null, company_id: dono?.company_id ?? null },
    });
    return { ok: true };
  }
}
