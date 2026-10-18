import { Body, Controller, Delete, Get, HttpCode, Post, Put, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AccessToken, UserId, UserSupabase } from '../../../common/http/request.decorators';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import type { UserSupabaseClient } from '../../../db/user-supabase';
import { CredenciaisService, EndpointsService, EventosService, LojasPixService } from '../application/pix.use-cases';
import {
  ChaveDeCredencialSchema,
  DesativarEndpointSchema,
  FeedSchema,
  ListaDeEndpointsSchema,
  RegistrarEndpointSchema,
  ResumoDeEventosSchema,
  SalvarCredencialSchema,
  type ChaveDeCredencial,
  type DesativarEndpoint,
  type FeedInput,
  type ListaDeEndpoints,
  type RegistrarEndpoint,
  type ResumoDeEventos,
  type SalvarCredencialInput,
} from '../dto/pix.schemas';
import { D } from './pix.docs';

/** Webhooks e credenciais PIXnoPDV (`easyCONTROL/src/lib/pix-webhooks/*`). */
@ApiTags('PIX')
@Controller('pix')
export class PixController {
  constructor(
    private readonly credenciais: CredenciaisService,
    private readonly eventos: EventosService,
    private readonly lojas: LojasPixService,
    private readonly endpoints: EndpointsService,
  ) {}

  // ── credenciais ──
  @Get('credentials')
  @D.rls('Credenciais por loja/ambiente (segredos mascarados)')
  listarCredenciais(@UserSupabase() db: UserSupabaseClient) {
    return this.credenciais.listar(db);
  }

  @Put('credentials')
  @D.rls('Grava (upsert) a credencial de uma loja num ambiente')
  salvarCredencial(@UserSupabase() db: UserSupabaseClient, @Body(new ZodValidationPipe(SalvarCredencialSchema)) b: SalvarCredencialInput) {
    return this.credenciais.salvar(db, b);
  }

  @Delete('credentials')
  @D.rls('Exclui a credencial de uma loja num ambiente')
  excluirCredencial(@UserSupabase() db: UserSupabaseClient, @Query(new ZodValidationPipe(ChaveDeCredencialSchema)) q: ChaveDeCredencial) {
    return this.credenciais.excluir(db, q);
  }

  // ── eventos ──
  @Get('events')
  @D.admin('Eventos recebidos com resumo por endpoint e por loja')
  resumo(@UserSupabase() db: UserSupabaseClient, @UserId() ator: string, @Query(new ZodValidationPipe(ResumoDeEventosSchema)) q: ResumoDeEventos) {
    return this.eventos.resumo(db, ator, q);
  }

  @Get('events/feed')
  @D.admin('Linha do tempo paginada por cursor (received_at)')
  feed(@UserSupabase() db: UserSupabaseClient, @UserId() ator: string, @Query(new ZodValidationPipe(FeedSchema)) q: FeedInput) {
    return this.eventos.feed(db, ator, q);
  }

  // ── lojas ──
  @Get('stores')
  @D.rls('Todas as lojas com o nome da empresa')
  listarLojas(@UserSupabase() db: UserSupabaseClient) {
    return this.lojas.listar(db);
  }

  // ── endpoints (EasyERP-API) ──
  @Get('endpoints')
  @D.easyerp('Endpoints de webhook cadastrados')
  listarEndpoints(@AccessToken() token: string, @Query(new ZodValidationPipe(ListaDeEndpointsSchema)) q: ListaDeEndpoints) {
    return this.endpoints.listar(token, q);
  }

  @Post('endpoints/register')
  @HttpCode(200)
  @D.easyerp('Registra (ou reativa) o endpoint de uma loja/ambiente/tipo')
  registrar(@AccessToken() token: string, @Body(new ZodValidationPipe(RegistrarEndpointSchema)) b: RegistrarEndpoint) {
    return this.endpoints.registrar(token, b);
  }

  @Post('endpoints/deactivate')
  @HttpCode(200)
  @D.easyerp('Desativa o endpoint de uma loja/ambiente/tipo')
  desativar(@AccessToken() token: string, @Body(new ZodValidationPipe(DesativarEndpointSchema)) b: DesativarEndpoint) {
    return this.endpoints.desativar(token, b);
  }
}
