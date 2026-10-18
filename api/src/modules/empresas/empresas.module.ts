import { Module } from '@nestjs/common';
import { EmpresasService } from './application/empresas.use-cases';
import { EmpresasController } from './http/empresas.controller';
import { EmpresasRepository } from './infrastructure/empresas.repository';

/** Telas "Empresas" e "Lojas". */
@Module({
  controllers: [EmpresasController],
  providers: [EmpresasRepository, EmpresasService],
})
export class EmpresasModule {}
