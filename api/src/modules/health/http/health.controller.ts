import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../../../common/decorators';
import { DocHealth, DocLive } from './health.docs';

@ApiTags('Health')
@Controller()
export class HealthController {
  /**
   * Liveness — NUNCA depende do Supabase/Stripe: responde 200 sempre que o processo aceita
   * requisições, para o orquestrador não dar rollback por causa de uma dependência.
   */
  @Public()
  @Get('health/live')
  @DocLive()
  live() {
    return { status: 'ok' };
  }

  /** Health público mínimo: só liveness. Métrica interna (contadores) não vaza aqui. */
  @Public()
  @Get('health')
  @DocHealth()
  health() {
    return { status: 'ok' };
  }
}
