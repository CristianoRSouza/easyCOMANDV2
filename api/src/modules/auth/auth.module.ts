import { Module } from '@nestjs/common';
import { LoginUseCase, LogoutUseCase, MeUseCase, RefreshUseCase } from './application/sessao.use-cases';
import { AuthController } from './http/auth.controller';
import { PapelAdminReader } from './infrastructure/papel-admin.reader';
import { SupabaseAuthGateway } from './infrastructure/supabase-auth.gateway';

/** Login, renovação, logout e revalidação do administrador. */
@Module({
  controllers: [AuthController],
  providers: [SupabaseAuthGateway, PapelAdminReader, LoginUseCase, RefreshUseCase, LogoutUseCase, MeUseCase],
})
export class AuthModule {}
