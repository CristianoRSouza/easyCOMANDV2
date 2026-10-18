import { Module } from '@nestjs/common';
import {
  CatalogoService,
  LicencasService,
  ModoStripeService,
  SincronizacaoStripeService,
} from './application/billing.use-cases';
import { BillingController } from './http/billing.controller';
import { BillingRepository } from './infrastructure/billing.repository';
import { StripePrecosGateway } from './infrastructure/stripe-precos.gateway';

/** Faturamento (`easyCONTROL/src/lib/billing/*`, `lib/stripe-invoke.ts`, telas de planos/faturamento). */
@Module({
  controllers: [BillingController],
  providers: [
    BillingRepository,
    StripePrecosGateway,
    CatalogoService,
    ModoStripeService,
    SincronizacaoStripeService,
    LicencasService,
  ],
})
export class BillingModule {}
