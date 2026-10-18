import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UuidPipe } from '../../../common/http/params';
import { UserId, UserSupabase } from '../../../common/http/request.decorators';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import type { UserSupabaseClient } from '../../../db/user-supabase';
import { VinculosService } from '../application/vinculos.use-cases';
import {
  BuscaDeUsuariosSchema,
  ListaDeVinculosSchema,
  NovoVinculoSchema,
  TrocaDeStatusSchema,
  type BuscaDeUsuarios,
  type ListaDeVinculos,
  type NovoVinculo,
  type TrocaDeStatus,
} from '../dto/vinculos.schemas';
import { DocCriar, DocEmpresas, DocExcluir, DocListar, DocStatus, DocUsuarios } from './vinculos.docs';

/** Tela "Vínculos usuário ↔ empresa" — o `manageUserCompanyAccess` de hoje. */
@ApiTags('Vínculos usuário ↔ empresa')
@Controller('user-company-access')
export class VinculosController {
  constructor(private readonly vinculos: VinculosService) {}

  @Get()
  @DocListar()
  listar(
    @UserSupabase() db: UserSupabaseClient,
    @UserId() ator: string,
    @Query(new ZodValidationPipe(ListaDeVinculosSchema)) q: ListaDeVinculos,
  ) {
    return this.vinculos.listar(db, ator, q);
  }

  @Get('companies')
  @DocEmpresas()
  empresas(@UserSupabase() db: UserSupabaseClient, @UserId() ator: string) {
    return this.vinculos.empresas(db, ator);
  }

  @Get('users')
  @DocUsuarios()
  usuarios(
    @UserSupabase() db: UserSupabaseClient,
    @UserId() ator: string,
    @Query(new ZodValidationPipe(BuscaDeUsuariosSchema)) q: BuscaDeUsuarios,
  ) {
    return this.vinculos.usuarios(db, ator, q.query);
  }

  @Post()
  @HttpCode(200)
  @DocCriar()
  criar(
    @UserSupabase() db: UserSupabaseClient,
    @UserId() ator: string,
    @Body(new ZodValidationPipe(NovoVinculoSchema)) body: NovoVinculo,
  ) {
    return this.vinculos.criar(db, ator, body);
  }

  @Patch(':id')
  @DocStatus()
  status(
    @UserSupabase() db: UserSupabaseClient,
    @UserId() ator: string,
    @Param('id', UuidPipe()) id: string,
    @Body(new ZodValidationPipe(TrocaDeStatusSchema)) body: TrocaDeStatus,
  ) {
    return this.vinculos.trocarStatus(db, ator, id, body.status);
  }

  @Delete(':id')
  @DocExcluir()
  excluir(@UserSupabase() db: UserSupabaseClient, @UserId() ator: string, @Param('id', UuidPipe()) id: string) {
    return this.vinculos.excluir(db, ator, id);
  }
}
