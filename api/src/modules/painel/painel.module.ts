import { Module } from '@nestjs/common';
import { PainelService } from './application/painel.use-cases';
import { PainelController } from './http/painel.controller';
import { PainelRepository } from './infrastructure/painel.repository';

/** Dashboard e telas dos módulos EasyCommandPay e EasyML Connect. */
@Module({
  controllers: [PainelController],
  providers: [PainelRepository, PainelService],
})
export class PainelModule {}
