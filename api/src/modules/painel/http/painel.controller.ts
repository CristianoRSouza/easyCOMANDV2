import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UserSupabase } from '../../../common/http/request.decorators';
import { DocSessao } from '../../../common/swagger';
import type { UserSupabaseClient } from '../../../db/user-supabase';
import { PainelService } from '../application/painel.use-cases';

const RLS = 'Sem gate na aplicação: a RLS do Supabase decide, como hoje.';

/** Dashboard e telas dos módulos EasyCommandPay e EasyML Connect. */
@ApiTags('Painel')
@Controller()
export class PainelController {
  constructor(private readonly painel: PainelService) {}

  @Get('dashboard/kpis')
  @DocSessao('KPIs do dashboard (13 contagens; erro em uma conta 0)', RLS)
  dashboard(@UserSupabase() db: UserSupabaseClient) {
    return this.painel.dashboard(db);
  }

  @Get('modules/easycommandpay/totems')
  @DocSessao('Totens (até 200) pelo último heartbeat', RLS)
  totens(@UserSupabase() db: UserSupabaseClient) {
    return this.painel.totens(db);
  }

  @Get('modules/easycommandpay/agents')
  @DocSessao('Agentes NFC-e (até 200)', RLS)
  agentes(@UserSupabase() db: UserSupabaseClient) {
    return this.painel.agentes(db);
  }

  @Get('modules/easycommandpay/kpis')
  @DocSessao('KPIs do EasyCommandPay (RPC get_easycommandpay_kpis)', RLS)
  kpisEasyCommandPay(@UserSupabase() db: UserSupabaseClient) {
    return this.painel.kpisEasyCommandPay(db);
  }

  @Get('modules/easyml/kpis')
  @DocSessao('KPIs do EasyML (RPC get_easyml_kpis)', RLS)
  kpisEasyMl(@UserSupabase() db: UserSupabaseClient) {
    return this.painel.kpisEasyMl(db);
  }

  @Get('modules/easyml/connections')
  @DocSessao('Conexões com o Mercado Livre (até 200)', RLS)
  conexoes(@UserSupabase() db: UserSupabaseClient) {
    return this.painel.conexoes(db);
  }

  @Get('modules/easyml/orders')
  @DocSessao('Pedidos do Mercado Livre (até 500)', RLS)
  pedidos(@UserSupabase() db: UserSupabaseClient) {
    return this.painel.pedidosMl(db);
  }

  @Get('modules/easyml/ai-usage')
  @DocSessao('Uso de IA (até 500, billing.usage_log_enriched)', RLS)
  usoDeIa(@UserSupabase() db: UserSupabaseClient) {
    return this.painel.usoDeIa(db);
  }
}
