import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../../../common/decorators';
import type { UsuarioAutenticado } from '../../../common/http/authenticated-request';
import { AccessToken, UserClaims, UserSupabase } from '../../../common/http/request.decorators';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import type { UserSupabaseClient } from '../../../db/user-supabase';
import { LoginUseCase, LogoutUseCase, MeUseCase, RefreshUseCase } from '../application/sessao.use-cases';
import { CredentialsSchema, RefreshSchema, type Credentials, type RefreshInput } from '../dto/auth.schemas';
import { DocLogin, DocLogout, DocMe, DocRefresh } from './auth.docs';

type JwtClaims = UsuarioAutenticado['claims'];

/**
 * Sessão do administrador — chamada SÓ pelo servidor do Next (BFF). A API cria a sessão no
 * Supabase e a devolve; quem grava cookie no navegador é o BFF.
 *
 * POST responde 200 (não o 201 padrão do Nest): o BFF confere `=== 200`.
 */
@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly login: LoginUseCase,
    private readonly refresh: RefreshUseCase,
    private readonly logout: LogoutUseCase,
    private readonly me: MeUseCase,
  ) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  @DocLogin()
  entrar(@Body(new ZodValidationPipe(CredentialsSchema)) body: Credentials) {
    return this.login.execute(body);
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  @DocRefresh()
  renovar(@Body(new ZodValidationPipe(RefreshSchema)) body: RefreshInput) {
    return this.refresh.execute(body.refresh_token);
  }

  @Post('logout')
  @HttpCode(204)
  @DocLogout()
  async sair(@AccessToken() token: string): Promise<void> {
    await this.logout.execute(token);
  }

  @Get('me')
  @DocMe()
  quemSouEu(@UserClaims() claims: JwtClaims, @UserSupabase() db: UserSupabaseClient, @AccessToken() token: string) {
    return this.me.execute(db, { id: String(claims.sub), email: claims.email, user_metadata: claims.user_metadata }, token);
  }
}
