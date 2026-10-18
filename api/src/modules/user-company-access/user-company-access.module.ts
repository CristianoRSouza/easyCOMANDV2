import { Module } from '@nestjs/common';
import { VinculosService } from './application/vinculos.use-cases';
import { VinculosController } from './http/vinculos.controller';
import { VinculosRepository } from './infrastructure/vinculos.repository';

/** Tela "Vínculos usuário ↔ empresa" (`easyCONTROL/src/lib/user-company-access/*`). */
@Module({
  controllers: [VinculosController],
  providers: [VinculosRepository, VinculosService],
})
export class UserCompanyAccessModule {}
