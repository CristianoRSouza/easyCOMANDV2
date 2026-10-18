import { Module } from '@nestjs/common';
import { AuditoriaService } from './application/auditoria.use-cases';
import { AuditoriaController } from './http/auditoria.controller';
import { AuditoriaRepository } from './infrastructure/auditoria.repository';

/** Telas de auditoria. */
@Module({
  controllers: [AuditoriaController],
  providers: [AuditoriaRepository, AuditoriaService],
})
export class AuditoriaTelasModule {}
