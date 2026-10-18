import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UuidPipe } from '../../../common/http/params';
import { UserId, UserSupabase } from '../../../common/http/request.decorators';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import type { UserSupabaseClient } from '../../../db/user-supabase';
import { RbacService } from '../application/rbac.use-cases';
import {
  AcessoNegadoSchema,
  AtribuicaoSchema,
  AuditoriaSchema,
  BuscaSchema,
  ContagemDeNegadosSchema,
  DuplicarRoleSchema,
  FiltroDeAtribuicoesSchema,
  FiltroDeOverridesSchema,
  LojasSchema,
  MinhasPermissoesSchema,
  ModuloSchema,
  OverrideSchema,
  PermissaoSchema,
  RoleSchema,
  type AcessoNegadoInput,
  type AtribuicaoInput,
  type AuditoriaInput,
  type BuscaInput,
  type ContagemDeNegados,
  type DuplicarRoleInput,
  type FiltroDeAtribuicoes,
  type FiltroDeOverrides,
  type LojasInput,
  type MinhasPermissoes,
  type ModuloInput,
  type OverrideInput,
  type PermissaoInput,
  type RoleInput,
} from '../dto/rbac.schemas';
import { D } from './rbac.docs';

/** RBAC (tela "RBAC" e a guarda de permissões das telas) — o `manageRbac` de hoje. */
@ApiTags('RBAC')
@Controller('rbac')
export class RbacController {
  constructor(private readonly rbac: RbacService) {}

  // ── módulos ──
  @Get('modules')
  @D.listaSemGate('Módulos com contagem de permissões')
  modulos(@UserSupabase() db: UserSupabaseClient) {
    return this.rbac.modulos(db);
  }

  @Post('modules')
  @HttpCode(200)
  @D.catalogo('Cria módulo (409→400 "Já existe um módulo com a chave …")')
  criarModulo(@UserSupabase() db: UserSupabaseClient, @UserId() ator: string, @Body(new ZodValidationPipe(ModuloSchema)) b: ModuloInput) {
    return this.rbac.salvarModulo(db, ator, undefined, b);
  }

  @Put('modules/:id')
  @D.catalogo('Edita módulo')
  editarModulo(
    @UserSupabase() db: UserSupabaseClient,
    @UserId() ator: string,
    @Param('id', UuidPipe()) id: string,
    @Body(new ZodValidationPipe(ModuloSchema)) b: ModuloInput,
  ) {
    return this.rbac.salvarModulo(db, ator, id, b);
  }

  // ── permissões ──
  @Get('permissions')
  @D.listaSemGate('Permissões com contagem de roles')
  permissoes(@UserSupabase() db: UserSupabaseClient) {
    return this.rbac.permissoes(db);
  }

  @Post('permissions')
  @HttpCode(200)
  @D.catalogo('Cria permissão')
  criarPermissao(@UserSupabase() db: UserSupabaseClient, @UserId() ator: string, @Body(new ZodValidationPipe(PermissaoSchema)) b: PermissaoInput) {
    return this.rbac.salvarPermissao(db, ator, undefined, b);
  }

  @Put('permissions/:id')
  @D.catalogo('Edita permissão')
  editarPermissao(
    @UserSupabase() db: UserSupabaseClient,
    @UserId() ator: string,
    @Param('id', UuidPipe()) id: string,
    @Body(new ZodValidationPipe(PermissaoSchema)) b: PermissaoInput,
  ) {
    return this.rbac.salvarPermissao(db, ator, id, b);
  }

  @Delete('permissions/:id')
  @D.catalogo('Exclui permissão sem vínculos com roles')
  excluirPermissao(@UserSupabase() db: UserSupabaseClient, @UserId() ator: string, @Param('id', UuidPipe()) id: string) {
    return this.rbac.excluirPermissao(db, ator, id);
  }

  // ── roles ──
  @Get('roles')
  @D.listaSemGate('Roles com ids e chaves das permissões')
  roles(@UserSupabase() db: UserSupabaseClient) {
    return this.rbac.roles(db);
  }

  @Post('roles')
  @HttpCode(200)
  @D.catalogo('Cria role (nunca de sistema)')
  criarRole(@UserSupabase() db: UserSupabaseClient, @UserId() ator: string, @Body(new ZodValidationPipe(RoleSchema)) b: RoleInput) {
    return this.rbac.criarRole(db, ator, b);
  }

  @Put('roles/:id')
  @D.catalogo('Edita role e substitui as permissões (role de sistema: key/name congelados)')
  editarRole(
    @UserSupabase() db: UserSupabaseClient,
    @UserId() ator: string,
    @Param('id', UuidPipe()) id: string,
    @Body(new ZodValidationPipe(RoleSchema)) b: RoleInput,
  ) {
    return this.rbac.editarRole(db, ator, id, b);
  }

  @Post('roles/:id/duplicate')
  @HttpCode(200)
  @D.catalogo('Duplica role com as permissões')
  duplicarRole(
    @UserSupabase() db: UserSupabaseClient,
    @UserId() ator: string,
    @Param('id', UuidPipe()) id: string,
    @Body(new ZodValidationPipe(DuplicarRoleSchema)) b: DuplicarRoleInput,
  ) {
    return this.rbac.duplicarRole(db, ator, id, b);
  }

  @Delete('roles/:id')
  @D.catalogo('Exclui role (nunca de sistema)')
  excluirRole(@UserSupabase() db: UserSupabaseClient, @UserId() ator: string, @Param('id', UuidPipe()) id: string) {
    return this.rbac.excluirRole(db, ator, id);
  }

  // ── atribuições ──
  @Get('assignments')
  @D.listaSemGate('Atribuições (até 500) com usuário, role, empresa e loja')
  atribuicoes(@UserSupabase() db: UserSupabaseClient, @Query(new ZodValidationPipe(FiltroDeAtribuicoesSchema)) q: FiltroDeAtribuicoes) {
    return this.rbac.atribuicoes(db, q);
  }

  @Post('assignments')
  @HttpCode(200)
  @D.gestao('Atribui role a usuário')
  atribuir(@UserSupabase() db: UserSupabaseClient, @UserId() ator: string, @Body(new ZodValidationPipe(AtribuicaoSchema)) b: AtribuicaoInput) {
    return this.rbac.atribuir(db, ator, b);
  }

  @Delete('assignments/:id')
  @D.gestao('Revoga atribuição')
  revogar(@UserSupabase() db: UserSupabaseClient, @UserId() ator: string, @Param('id', UuidPipe()) id: string) {
    return this.rbac.revogar(db, ator, id);
  }

  // ── seletores ──
  @Get('users')
  @D.listaSemGate('Busca usuários (até 50)')
  usuarios(@UserSupabase() db: UserSupabaseClient, @Query(new ZodValidationPipe(BuscaSchema)) q: BuscaInput) {
    return this.rbac.buscarUsuarios(db, q.query);
  }

  @Get('companies')
  @D.listaSemGate('Empresas (nome vazio vira "—")')
  empresas(@UserSupabase() db: UserSupabaseClient) {
    return this.rbac.empresas(db);
  }

  @Get('stores')
  @D.listaSemGate('Lojas (até 500), opcionalmente de uma empresa')
  lojas(@UserSupabase() db: UserSupabaseClient, @Query(new ZodValidationPipe(LojasSchema)) q: LojasInput) {
    return this.rbac.lojas(db, q.company_id);
  }

  // ── overrides ──
  @Get('overrides')
  @D.listaSemGate('Overrides de permissão de um usuário')
  overrides(@UserSupabase() db: UserSupabaseClient, @Query(new ZodValidationPipe(FiltroDeOverridesSchema)) q: FiltroDeOverrides) {
    return this.rbac.overrides(db, q.user_id, q.company_id);
  }

  @Post('overrides')
  @HttpCode(200)
  @D.gestao('Cria override (grant/deny)')
  criarOverride(@UserSupabase() db: UserSupabaseClient, @UserId() ator: string, @Body(new ZodValidationPipe(OverrideSchema)) b: OverrideInput) {
    return this.rbac.criarOverride(db, ator, b);
  }

  @Delete('overrides/:id')
  @D.gestao('Remove override')
  excluirOverride(@UserSupabase() db: UserSupabaseClient, @UserId() ator: string, @Param('id', UuidPipe()) id: string) {
    return this.rbac.excluirOverride(db, ator, id);
  }

  // ── auditoria ──
  @Get('audit')
  @D.catalogo('Trilha do RBAC (pv_rbac_audit_log) com o autor')
  auditoria(@UserSupabase() db: UserSupabaseClient, @UserId() ator: string, @Query(new ZodValidationPipe(AuditoriaSchema)) q: AuditoriaInput) {
    return this.rbac.auditoriaRbac(db, ator, q);
  }

  @Post('access-denied')
  @HttpCode(200)
  @D.qualquer('Registra o próprio acesso negado')
  negado(@UserSupabase() db: UserSupabaseClient, @UserId() ator: string, @Body(new ZodValidationPipe(AcessoNegadoSchema)) b: AcessoNegadoInput) {
    return this.rbac.registrarNegado(db, ator, b);
  }

  @Get('access-denied/count')
  @D.catalogo('Acessos negados nas últimas N horas')
  contarNegados(@UserSupabase() db: UserSupabaseClient, @UserId() ator: string, @Query(new ZodValidationPipe(ContagemDeNegadosSchema)) q: ContagemDeNegados) {
    return this.rbac.contarNegados(db, ator, q.hours);
  }

  @Get('my-permissions')
  @D.qualquer('Chaves de permissão do usuário da sessão (RPC current_user_permissions)')
  minhas(@UserSupabase() db: UserSupabaseClient, @Query(new ZodValidationPipe(MinhasPermissoesSchema)) q: MinhasPermissoes) {
    return this.rbac.minhasPermissoes(db, q.company_id);
  }
}
