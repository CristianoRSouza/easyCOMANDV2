import { Body, Controller, Get, HttpCode, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UuidPipe } from '../../../common/http/params';
import { UserId, UserSupabase } from '../../../common/http/request.decorators';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import type { UserSupabaseClient } from '../../../db/user-supabase';
import {
  CatalogoService,
  LicencasService,
  ModoStripeService,
  SincronizacaoStripeService,
} from '../application/billing.use-cases';
import {
  ConfigQuerySchema,
  ModoStripeSchema,
  PatchDeCustoSchema,
  PatchDePacoteSchema,
  PatchDePlanoSchema,
  PlanosQuerySchema,
  SincronizarPlanosSchema,
  UsoDoCacheSchema,
  ValorDeConfigSchema,
  type ConfigQuery,
  type ModoStripeInput,
  type PatchDeCusto,
  type PatchDePacote,
  type PatchDePlano,
  type PlanosQuery,
  type SincronizarPlanos,
  type UsoDoCache,
  type ValorDeConfig,
} from '../dto/billing.schemas';
import { D } from './billing.docs';

/**
 * Faturamento: configuração global, planos por módulo, créditos de IA, modo do Stripe e
 * licenças — tudo que hoje as telas consultam direto do navegador em `billing.*`.
 */
@ApiTags('Faturamento')
@Controller('billing')
export class BillingController {
  constructor(
    private readonly catalogo: CatalogoService,
    private readonly modo: ModoStripeService,
    private readonly sincronizacao: SincronizacaoStripeService,
    private readonly licencas: LicencasService,
  ) {}

  // ── configuração ──
  @Get('config')
  @D.rls('Bases de cálculo (billing.config), por categoria e chave')
  config(@UserSupabase() db: UserSupabaseClient, @Query(new ZodValidationPipe(ConfigQuerySchema)) q: ConfigQuery) {
    return this.catalogo.config(db, q.category);
  }

  @Get('config/reference-usd-brl')
  @D.rls('Cotação USD→BRL de referência (null quando ausente ou inválida)')
  cotacao(@UserSupabase() db: UserSupabaseClient) {
    return this.catalogo.cotacao(db);
  }

  @Patch('config/:id')
  @D.rls('Grava o valor (jsonb) de uma configuração')
  atualizarConfig(
    @UserSupabase() db: UserSupabaseClient,
    @Param('id', UuidPipe()) id: string,
    @Body(new ZodValidationPipe(ValorDeConfigSchema)) b: ValorDeConfig,
  ) {
    return this.catalogo.atualizarConfig(db, id, b.value);
  }

  // ── planos por módulo ──
  @Get('module-plans')
  @D.rls('Planos de um módulo (billing.module_plans)')
  planos(@UserSupabase() db: UserSupabaseClient, @Query(new ZodValidationPipe(PlanosQuerySchema)) q: PlanosQuery) {
    return this.catalogo.planos(db, q.module);
  }

  @Patch('module-plans/:id')
  @D.rls('Edita campos de um plano')
  atualizarPlano(
    @UserSupabase() db: UserSupabaseClient,
    @Param('id', UuidPipe()) id: string,
    @Body(new ZodValidationPipe(PatchDePlanoSchema)) b: PatchDePlano,
  ) {
    return this.catalogo.atualizarPlano(db, id, b);
  }

  // ── IA ──
  @Get('ai/credit-packages')
  @D.rls('Pacotes de créditos de IA')
  pacotes(@UserSupabase() db: UserSupabaseClient) {
    return this.catalogo.pacotes(db);
  }

  @Patch('ai/credit-packages/:id')
  @D.rls('Edita um pacote de créditos')
  atualizarPacote(
    @UserSupabase() db: UserSupabaseClient,
    @Param('id', UuidPipe()) id: string,
    @Body(new ZodValidationPipe(PatchDePacoteSchema)) b: PatchDePacote,
  ) {
    return this.catalogo.atualizarPacote(db, id, b);
  }

  @Post('ai/credit-packages/sync-stripe')
  @HttpCode(200)
  @D.stripe('Casa cada pacote com um preço ativo do Stripe (modo da preferência do usuário)')
  sincronizarPacotes(@UserSupabase() db: UserSupabaseClient, @UserId() userId: string) {
    return this.sincronizacao.priceIdsDosPacotes(db, userId);
  }

  @Get('ai/model-costs')
  @D.rls('Custos por modelo de IA')
  custos(@UserSupabase() db: UserSupabaseClient) {
    return this.catalogo.custos(db);
  }

  @Patch('ai/model-costs/:id')
  @D.rls('Edita o custo de um modelo')
  atualizarCusto(
    @UserSupabase() db: UserSupabaseClient,
    @Param('id', UuidPipe()) id: string,
    @Body(new ZodValidationPipe(PatchDeCustoSchema)) b: PatchDeCusto,
  ) {
    return this.catalogo.atualizarCusto(db, id, b);
  }

  @Get('ai/cache-usage')
  @D.rls('Uso de IA (tokens de entrada e em cache) dos últimos N dias')
  usoDoCache(@UserSupabase() db: UserSupabaseClient, @Query(new ZodValidationPipe(UsoDoCacheSchema)) q: UsoDoCache) {
    return this.catalogo.usoDoCache(db, q.days, q.app);
  }

  // ── Stripe ──
  @Get('stripe-mode')
  @D.rls('Modo do Stripe preferido pelo usuário (null quando a leitura falhou)')
  lerModo(@UserSupabase() db: UserSupabaseClient, @UserId() userId: string) {
    return this.modo.ler(db, userId);
  }

  @Put('stripe-mode')
  @D.rls('Grava o modo do Stripe preferido pelo usuário')
  gravarModo(
    @UserSupabase() db: UserSupabaseClient,
    @UserId() userId: string,
    @Body(new ZodValidationPipe(ModoStripeSchema)) b: ModoStripeInput,
  ) {
    return this.modo.gravar(db, userId, b.mode);
  }

  @Post('stripe-sync-plans')
  @HttpCode(200)
  @D.stripe('Roda a Edge Function stripe-sync-plans num ambiente (test ou live)')
  sincronizarPlanos(@UserSupabase() db: UserSupabaseClient, @Body(new ZodValidationPipe(SincronizarPlanosSchema)) b: SincronizarPlanos) {
    return this.sincronizacao.planos(db, b);
  }

  // ── licenças ──
  @Get('totem-licenses')
  @D.rls('Licenças de totem (até 300) com o nome da empresa')
  licencasDeTotem(@UserSupabase() db: UserSupabaseClient) {
    return this.licencas.deTotem(db);
  }

  @Get('company-plans')
  @D.rls('Licenças por empresa/módulo com o uso de IA dos últimos 30 dias')
  planosDasEmpresas(@UserSupabase() db: UserSupabaseClient) {
    return this.licencas.planosDasEmpresas(db);
  }
}
