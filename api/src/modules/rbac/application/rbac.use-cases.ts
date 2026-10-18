import { Injectable } from '@nestjs/common';
import { AuditoriaRbac } from '../../../common/auditoria/auditoria-rbac';
import { AutorizacaoService } from '../../../common/autorizacao';
import { filtroEmailOuNome } from '../../../common/consulta';
import { naoEncontrado } from '../../../common/erros';
import type { UserSupabaseClient } from '../../../db/user-supabase';
import {
  conferirAtribuicao,
  conferirEdicaoDeRoleDeSistema,
  conferirExclusaoDePermissao,
  conferirExclusaoDeRole,
  conferirGestaoNaEmpresa,
  contar,
  permissoesPorRole,
  type OverrideEffect,
  type RbacAssignment,
  type RbacAuditEntry,
  type RbacModule,
  type RbacOverride,
  type RbacPermission,
  type RbacRole,
  type RbacScope,
} from '../domain/rbac';
import { RbacRepository } from '../infrastructure/rbac.repository';

type Db = UserSupabaseClient;

/**
 * `manageRbac` de hoje, uma ação por método.
 *
 * Gates (os MESMOS de hoje — e eles variam):
 *   • listas (módulos, permissões, roles, atribuições, usuários, empresas, lojas, overrides):
 *     SEM gate na aplicação — quem decide o que aparece é a RLS;
 *   • escrita de catálogo (módulo, permissão, role), auditoria e contagem de negados:
 *     system_admin, com a mensagem genérica "Permissão negada";
 *   • atribuição/override: system_admin OU company_admin da empresa (ver domain);
 *   • registrar o próprio acesso negado: qualquer usuário autenticado.
 */
@Injectable()
export class RbacService {
  constructor(
    private readonly autorizacao: AutorizacaoService,
    private readonly repo: RbacRepository,
    private readonly auditoria: AuditoriaRbac,
  ) {}

  private exigirSystemAdmin(db: Db, ator: string) {
    return this.autorizacao.exigirSystemAdmin(db, ator, 'Permissão negada');
  }

  private auditar(db: Db, ator: string, action: string, entity: string, entityId: string | null, payload: unknown) {
    return this.auditoria.registrar(db, { actor_id: ator, action, entity, entity_id: entityId, payload });
  }

  // ── módulos ──────────────────────────────────────────────────────────────

  async modulos(db: Db): Promise<RbacModule[]> {
    const modulos = await this.repo.modulos(db);
    const contagem = contar(await this.repo.moduloDeCadaPermissao(db));
    return modulos.map((m) => ({ ...m, permission_count: contagem.get(m.key) ?? 0 }));
  }

  async salvarModulo(
    db: Db,
    ator: string,
    id: string | undefined,
    m: { key: string; name: string; description?: string | null; version: string; is_active: boolean },
  ): Promise<Record<string, unknown>> {
    await this.exigirSystemAdmin(db, ator);
    const linha = { key: m.key, name: m.name, description: m.description ?? null, version: m.version, is_active: m.is_active };
    const salvo = await this.repo.salvarModulo(db, id, linha, m.key);
    await this.auditar(db, ator, id ? 'update' : 'create', 'module', id ?? String(salvo.id), linha);
    return salvo;
  }

  // ── permissões ───────────────────────────────────────────────────────────

  async permissoes(db: Db): Promise<RbacPermission[]> {
    const permissoes = await this.repo.permissoes(db);
    const contagem = contar(await this.repo.permissaoDeCadaVinculo(db));
    return permissoes.map((p) => ({ ...p, role_count: contagem.get(p.id) ?? 0 }));
  }

  async salvarPermissao(
    db: Db,
    ator: string,
    id: string | undefined,
    p: { key: string; module_key: string; scope: RbacScope; description?: string | null; is_active: boolean },
  ): Promise<Record<string, unknown>> {
    await this.exigirSystemAdmin(db, ator);
    const linha = { key: p.key, module_key: p.module_key, scope: p.scope, description: p.description ?? null, is_active: p.is_active };
    const salvo = await this.repo.salvarPermissao(db, id, linha);
    await this.auditar(db, ator, id ? 'update' : 'create', 'permission', id ?? String(salvo.id), linha);
    return salvo;
  }

  async excluirPermissao(db: Db, ator: string, id: string): Promise<{ ok: true }> {
    await this.exigirSystemAdmin(db, ator);
    conferirExclusaoDePermissao(await this.repo.vinculosDaPermissao(db, id));
    await this.repo.excluirPermissao(db, id);
    await this.auditar(db, ator, 'delete', 'permission', id, {});
    return { ok: true };
  }

  // ── roles ────────────────────────────────────────────────────────────────

  async roles(db: Db): Promise<RbacRole[]> {
    const roles = await this.repo.roles(db);
    const porRole = permissoesPorRole(await this.repo.vinculosRolePermissao(db));
    return roles.map((r) => ({
      ...r,
      permission_ids: porRole.get(r.id)?.ids ?? [],
      permission_keys: porRole.get(r.id)?.keys ?? [],
    }));
  }

  async criarRole(
    db: Db,
    ator: string,
    r: { key: string; name: string; description?: string | null; scope: RbacScope; permission_ids: string[] },
  ): Promise<Record<string, unknown>> {
    await this.exigirSystemAdmin(db, ator);
    const criada = await this.repo.criarRole(db, {
      key: r.key,
      name: r.name,
      description: r.description ?? null,
      scope: r.scope,
      is_system: false,
    });
    const novoId = String(criada.id);
    await this.repo.ligarPermissoes(db, novoId, r.permission_ids, false);
    await this.auditar(db, ator, 'create', 'role', novoId, { name: r.name, permission_count: r.permission_ids.length });
    return criada;
  }

  /**
   * Edição de hoje, sem transação: atualiza a role, APAGA todos os vínculos e grava os novos. Se
   * a gravação falhar no meio, a role fica sem permissões — igual a hoje (decisoes-pendentes.md).
   */
  async editarRole(
    db: Db,
    ator: string,
    id: string,
    r: { key: string; name: string; description?: string | null; scope: RbacScope; permission_ids: string[] },
  ): Promise<{ id: string }> {
    await this.exigirSystemAdmin(db, ator);
    conferirEdicaoDeRoleDeSistema(await this.repo.role(db, id), r);
    await this.repo.atualizarRole(db, id, { key: r.key, name: r.name, description: r.description ?? null, scope: r.scope });
    await this.repo.limparPermissoesDaRole(db, id);
    await this.repo.ligarPermissoes(db, id, r.permission_ids, true);
    await this.auditar(db, ator, 'update', 'role', id, { name: r.name, permission_count: r.permission_ids.length });
    return { id };
  }

  async duplicarRole(db: Db, ator: string, origem: string, nova: { new_key: string; new_name: string }): Promise<Record<string, unknown>> {
    await this.exigirSystemAdmin(db, ator);
    const fonte = await this.repo.role(db, origem);
    if (!fonte) throw naoEncontrado('Role de origem não encontrada');
    const criada = await this.repo.criarRole(db, {
      key: nova.new_key,
      name: nova.new_name,
      description: fonte.description,
      scope: fonte.scope,
      is_system: false,
    });
    const novoId = String(criada.id);
    await this.repo.ligarPermissoes(db, novoId, await this.repo.permissoesDaRole(db, origem), false);
    await this.auditar(db, ator, 'duplicate', 'role', novoId, { source_id: origem, new_name: nova.new_name });
    return criada;
  }

  async excluirRole(db: Db, ator: string, id: string): Promise<{ ok: true }> {
    await this.exigirSystemAdmin(db, ator);
    conferirExclusaoDeRole(await this.repo.role(db, id));
    await this.repo.excluirRole(db, id);
    await this.auditar(db, ator, 'delete', 'role', id, {});
    return { ok: true };
  }

  // ── atribuições ──────────────────────────────────────────────────────────

  async atribuicoes(db: Db, f: { user_id?: string; company_id?: string }): Promise<RbacAssignment[]> {
    const linhas = await this.repo.atribuicoes(db, f);
    const distintos = (xs: Array<string | null>) => Array.from(new Set(xs.filter((x): x is string => !!x)));
    const [perfis, empresas, lojas] = await Promise.all([
      this.repo.perfis(db, distintos(linhas.map((a) => a.user_id))),
      this.repo.empresas(db, distintos(linhas.map((a) => a.company_id))),
      this.repo.lojas(db, distintos(linhas.map((a) => a.store_id))),
    ]);
    const perfil = new Map(perfis.map((p) => [p.id, p]));
    const empresa = new Map(empresas.map((c) => [c.id, c]));
    const loja = new Map(lojas.map((s) => [s.id, s]));
    return linhas.map((a) => ({
      id: a.id,
      user_id: a.user_id,
      role_id: a.role_id,
      company_id: a.company_id,
      store_id: a.store_id,
      created_at: a.created_at,
      role: a.pv_roles,
      user: { id: a.user_id, email: perfil.get(a.user_id)?.email ?? null, full_name: perfil.get(a.user_id)?.full_name ?? null },
      company:
        a.company_id && empresa.has(a.company_id)
          ? { id: a.company_id, name: empresa.get(a.company_id)?.name ?? null }
          : null,
      store:
        a.store_id && loja.has(a.store_id) ? { id: a.store_id, trade_name: loja.get(a.store_id)?.trade_name ?? null } : null,
    }));
  }

  async atribuir(
    db: Db,
    ator: string,
    a: { user_id: string; role_id: string; company_id?: string | null; store_id?: string | null },
  ): Promise<Record<string, unknown>> {
    const sysAdmin = await this.autorizacao.ehSystemAdmin(db, ator);
    const companyId = a.company_id ?? null;
    await conferirAtribuicao(await this.repo.roleParaAtribuir(db, a.role_id), companyId, sysAdmin, (c) =>
      this.autorizacao.ehCompanyAdmin(db, ator, c),
    );
    const criada = await this.repo.criarAtribuicao(db, {
      user_id: a.user_id,
      role_id: a.role_id,
      company_id: companyId,
      store_id: a.store_id ?? null,
      created_by: ator,
    });
    await this.auditar(db, ator, 'assign_role', 'user_role_assignment', String(criada.id), {
      user_id: a.user_id,
      role_id: a.role_id,
      company_id: companyId,
      store_id: a.store_id ?? null,
    });
    return criada;
  }

  async revogar(db: Db, ator: string, id: string): Promise<{ ok: true }> {
    const linha = await this.repo.atribuicao(db, id);
    if (!linha) throw naoEncontrado('Atribuição não encontrada');
    const sysAdmin = await this.autorizacao.ehSystemAdmin(db, ator);
    await conferirGestaoNaEmpresa(
      linha.company_id,
      sysAdmin,
      (c) => this.autorizacao.ehCompanyAdmin(db, ator, c),
      linha.pv_roles.scope === 'global',
    );
    await this.repo.excluirAtribuicao(db, id);
    await this.auditar(db, ator, 'revoke_assignment', 'user_role_assignment', id, {});
    return { ok: true };
  }

  // ── seletores ────────────────────────────────────────────────────────────

  buscarUsuarios(db: Db, termo: string) {
    return this.repo.buscarUsuarios(db, filtroEmailOuNome(termo));
  }

  /** Nome vazio vira "—", como hoje. */
  async empresas(db: Db): Promise<Array<{ id: string; name: string }>> {
    return (await this.repo.todasAsEmpresas(db)).map((c) => ({ id: c.id, name: c.name ?? '—' }));
  }

  lojas(db: Db, companyId?: string) {
    return this.repo.lojasDaEmpresa(db, companyId);
  }

  // ── overrides ────────────────────────────────────────────────────────────

  async overrides(db: Db, userId: string, companyId?: string): Promise<RbacOverride[]> {
    return (await this.repo.overrides(db, userId, companyId)).map((o) => ({
      id: o.id,
      user_id: o.user_id,
      permission_id: o.permission_id,
      company_id: o.company_id,
      store_id: o.store_id,
      effect: o.effect,
      permission: o.pv_permissions,
    }));
  }

  async criarOverride(
    db: Db,
    ator: string,
    o: { user_id: string; permission_id: string; effect: OverrideEffect; company_id?: string | null; store_id?: string | null },
  ): Promise<Record<string, unknown>> {
    const sysAdmin = await this.autorizacao.ehSystemAdmin(db, ator);
    const companyId = o.company_id ?? null;
    await conferirGestaoNaEmpresa(companyId, sysAdmin, (c) => this.autorizacao.ehCompanyAdmin(db, ator, c));
    const criado = await this.repo.criarOverride(db, {
      user_id: o.user_id,
      permission_id: o.permission_id,
      company_id: companyId,
      store_id: o.store_id ?? null,
      effect: o.effect,
      created_by: ator,
    });
    await this.auditar(db, ator, 'set_override', 'user_permission', String(criado.id), {
      user_id: o.user_id,
      permission_id: o.permission_id,
      effect: o.effect,
    });
    return criado;
  }

  async excluirOverride(db: Db, ator: string, id: string): Promise<{ ok: true }> {
    const linha = await this.repo.override(db, id);
    if (!linha) throw naoEncontrado('Override não encontrado');
    const sysAdmin = await this.autorizacao.ehSystemAdmin(db, ator);
    await conferirGestaoNaEmpresa(linha.company_id, sysAdmin, (c) => this.autorizacao.ehCompanyAdmin(db, ator, c));
    await this.repo.excluirOverride(db, id);
    await this.auditar(db, ator, 'delete_override', 'user_permission', id, {});
    return { ok: true };
  }

  // ── auditoria ────────────────────────────────────────────────────────────

  async auditoriaRbac(
    db: Db,
    ator: string,
    f: { limit: number; offset: number; entity?: string; actor_id?: string },
  ): Promise<{ rows: RbacAuditEntry[]; total: number }> {
    await this.exigirSystemAdmin(db, ator);
    const { linhas, total } = await this.repo.auditoria(db, f);
    const atores = Array.from(new Set(linhas.map((r) => r.actor_id).filter((x): x is string => !!x)));
    const perfil = new Map((await this.repo.perfis(db, atores)).map((p) => [p.id, { email: p.email, full_name: p.full_name }]));
    return {
      rows: linhas.map((r) => ({ ...r, actor: r.actor_id ? perfil.get(r.actor_id) ?? null : null })),
      total: total ?? linhas.length,
    };
  }

  async registrarNegado(db: Db, ator: string, d: { path: string; attempted_role?: string | null }): Promise<{ ok: true }> {
    await this.auditar(db, ator, 'access_denied', 'route', null, {
      path: d.path,
      attempted_role: d.attempted_role ?? null,
      at: new Date().toISOString(),
    });
    return { ok: true };
  }

  async contarNegados(db: Db, ator: string, horas: number): Promise<{ count: number }> {
    await this.exigirSystemAdmin(db, ator);
    const desde = new Date(Date.now() - horas * 60 * 60 * 1000).toISOString();
    return { count: await this.repo.negadosDesde(db, desde) };
  }

  minhasPermissoes(db: Db, companyId?: string): Promise<string[]> {
    return this.repo.minhasPermissoes(db, companyId);
  }
}
