import { Module } from '@nestjs/common';
import { HealthController } from './http/health.controller';

/** Liveness do processo. Sem dependência de propósito (ver o controller). */
@Module({ controllers: [HealthController] })
export class HealthModule {}
