import { Module } from '@nestjs/common';
import { CredenciaisService, EndpointsService, EventosService, LojasPixService } from './application/pix.use-cases';
import { PixController } from './http/pix.controller';
import { CredenciaisRepository } from './infrastructure/credenciais.repository';
import { EasyErpGateway } from './infrastructure/easyerp.gateway';
import { EventosRepository } from './infrastructure/eventos.repository';
import { LojasRepository } from './infrastructure/lojas.repository';

/** Webhooks PIX e credenciais PIXnoPDV. */
@Module({
  controllers: [PixController],
  providers: [
    CredenciaisRepository,
    EventosRepository,
    LojasRepository,
    EasyErpGateway,
    CredenciaisService,
    EventosService,
    LojasPixService,
    EndpointsService,
  ],
})
export class PixModule {}
