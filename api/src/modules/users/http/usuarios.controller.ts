import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UuidPipe } from '../../../common/http/params';
import { UserId, UserSupabase } from '../../../common/http/request.decorators';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import type { UserSupabaseClient } from '../../../db/user-supabase';
import { UsuariosService } from '../application/usuarios.use-cases';
import { AtivoSchema, ListaDeUsuariosSchema, type AtivoInput, type ListaDeUsuarios } from '../dto/usuarios.schemas';
import { DocAtivo, DocExcluir, DocListar, DocPromover, DocRebaixar } from './usuarios.docs';

/** Tela "Usuários" — o `manageUsers` de hoje, uma rota por ação. */
@ApiTags('Usuários')
@Controller('users')
export class UsuariosController {
  constructor(private readonly usuarios: UsuariosService) {}

  @Get()
  @DocListar()
  listar(
    @UserSupabase() db: UserSupabaseClient,
    @UserId() ator: string,
    @Query(new ZodValidationPipe(ListaDeUsuariosSchema)) q: ListaDeUsuarios,
  ) {
    return this.usuarios.listar(db, ator, q);
  }

  @Post(':id/promote')
  @HttpCode(200)
  @DocPromover()
  promover(@UserSupabase() db: UserSupabaseClient, @UserId() ator: string, @Param('id', UuidPipe()) id: string) {
    return this.usuarios.promover(db, ator, id);
  }

  @Post(':id/demote')
  @HttpCode(200)
  @DocRebaixar()
  rebaixar(@UserSupabase() db: UserSupabaseClient, @UserId() ator: string, @Param('id', UuidPipe()) id: string) {
    return this.usuarios.rebaixar(db, ator, id);
  }

  @Patch(':id/active')
  @DocAtivo()
  ativo(
    @UserSupabase() db: UserSupabaseClient,
    @UserId() ator: string,
    @Param('id', UuidPipe()) id: string,
    @Body(new ZodValidationPipe(AtivoSchema)) body: AtivoInput,
  ) {
    return this.usuarios.definirAtivo(db, ator, id, body.is_active);
  }

  @Delete(':id')
  @DocExcluir()
  excluir(@UserSupabase() db: UserSupabaseClient, @UserId() ator: string, @Param('id', UuidPipe()) id: string) {
    return this.usuarios.excluir(db, ator, id);
  }
}
