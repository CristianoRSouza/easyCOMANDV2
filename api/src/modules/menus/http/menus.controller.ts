import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UuidPipe } from '../../../common/http/params';
import { UserId, UserSupabase } from '../../../common/http/request.decorators';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import type { UserSupabaseClient } from '../../../db/user-supabase';
import { MenusService } from '../application/menus.use-cases';
import {
  MenuSchema,
  OrdemSchema,
  SubmenuSchema,
  type MenuInput,
  type OrdemInput,
  type SubmenuInput,
} from '../dto/menus.schemas';
import { DocEscrita, DocLeitura } from './menus.docs';

/**
 * Tela "Menus" — o `manageMenus` de hoje. As rotas de submenu e de reordenação vêm ANTES das de
 * `:id` para o roteador não tomar "submenus"/"reorder" por um id.
 */
@ApiTags('Menus')
@Controller('menus')
export class MenusController {
  constructor(private readonly menus: MenusService) {}

  @Get('access')
  @DocLeitura('O usuário pode gerenciar menus? (`core.menus.manage`)')
  acesso(@UserSupabase() db: UserSupabaseClient, @UserId() ator: string) {
    return this.menus.acesso(db, ator);
  }

  @Get()
  @DocLeitura('Menus e submenus, por display_order')
  listar(@UserSupabase() db: UserSupabaseClient) {
    return this.menus.listar(db);
  }

  @Get('permissions')
  @DocLeitura('Permissões ativas, para o seletor de "permissão exigida"')
  permissoes(@UserSupabase() db: UserSupabaseClient) {
    return this.menus.permissoes(db);
  }

  @Get('modules')
  @DocLeitura('Módulos ativos, como opções { value, label, description }')
  modulos(@UserSupabase() db: UserSupabaseClient) {
    return this.menus.modulos(db);
  }

  // ── submenus ──
  @Post('submenus')
  @HttpCode(200)
  @DocEscrita('Cria submenu')
  criarSubmenu(@UserSupabase() db: UserSupabaseClient, @UserId() ator: string, @Body(new ZodValidationPipe(SubmenuSchema)) b: SubmenuInput) {
    return this.menus.salvarSubmenu(db, ator, undefined, b);
  }

  @Put('submenus/:id')
  @DocEscrita('Edita submenu')
  editarSubmenu(
    @UserSupabase() db: UserSupabaseClient,
    @UserId() ator: string,
    @Param('id', UuidPipe()) id: string,
    @Body(new ZodValidationPipe(SubmenuSchema)) b: SubmenuInput,
  ) {
    return this.menus.salvarSubmenu(db, ator, id, b);
  }

  @Delete('submenus/:id')
  @DocEscrita('Exclui submenu e os filhos dele')
  excluirSubmenu(@UserSupabase() db: UserSupabaseClient, @UserId() ator: string, @Param('id', UuidPipe()) id: string) {
    return this.menus.excluirSubmenu(db, ator, id);
  }

  @Post('reorder')
  @HttpCode(200)
  @DocEscrita('Reordena menus')
  reordenarMenus(@UserSupabase() db: UserSupabaseClient, @UserId() ator: string, @Body(new ZodValidationPipe(OrdemSchema)) b: OrdemInput) {
    return this.menus.reordenarMenus(db, ator, b.rows);
  }

  @Post(':id/submenus/reorder')
  @HttpCode(200)
  @DocEscrita('Reordena os submenus de um menu')
  reordenarSubmenus(
    @UserSupabase() db: UserSupabaseClient,
    @UserId() ator: string,
    @Param('id', UuidPipe()) id: string,
    @Body(new ZodValidationPipe(OrdemSchema)) b: OrdemInput,
  ) {
    return this.menus.reordenarSubmenus(db, ator, id, b.rows);
  }

  // ── menus ──
  @Post()
  @HttpCode(200)
  @DocEscrita('Cria menu')
  criarMenu(@UserSupabase() db: UserSupabaseClient, @UserId() ator: string, @Body(new ZodValidationPipe(MenuSchema)) b: MenuInput) {
    return this.menus.salvarMenu(db, ator, undefined, b);
  }

  @Put(':id')
  @DocEscrita('Edita menu')
  editarMenu(
    @UserSupabase() db: UserSupabaseClient,
    @UserId() ator: string,
    @Param('id', UuidPipe()) id: string,
    @Body(new ZodValidationPipe(MenuSchema)) b: MenuInput,
  ) {
    return this.menus.salvarMenu(db, ator, id, b);
  }

  @Delete(':id')
  @DocEscrita('Exclui menu e todos os submenus dele')
  excluirMenu(@UserSupabase() db: UserSupabaseClient, @UserId() ator: string, @Param('id', UuidPipe()) id: string) {
    return this.menus.excluirMenu(db, ator, id);
  }
}
