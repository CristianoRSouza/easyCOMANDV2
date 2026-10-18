import { Module } from '@nestjs/common';
import { UsuariosService } from './application/usuarios.use-cases';
import { UsuariosController } from './http/usuarios.controller';
import { UsuariosRepository } from './infrastructure/usuarios.repository';

/** Tela "Usuários" (`easyCONTROL/src/lib/users/users.functions.ts`). */
@Module({
  controllers: [UsuariosController],
  providers: [UsuariosRepository, UsuariosService],
})
export class UsersModule {}
