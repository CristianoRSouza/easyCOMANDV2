import { Injectable, Logger } from '@nestjs/common';
import { SupabaseAdmin, type SupabaseAdminClient } from './supabase-admin';

/**
 * Por que um módulo usa a service_role — enum FECHADO, para revisão e métrica.
 *
 * Cada motivo corresponde a um uso de chave administrativa no EasyControl atual. Um módulo novo
 * que precise escalar acrescenta um motivo AQUI, com comentário — e quem revisa o diff vê a
 * superfície privilegiada crescendo. "Uso o admin porque a RLS atrapalha" não é motivo.
 */
export type ServiceRoleReason =
  // Excluir usuário de vez: `auth.admin.deleteUser` + limpeza de `pv_user_roles`/`pb_profiles`
  // (`lib/users/users.functions.ts`, ação `delete`). Só depois do gate de system_admin.
  | 'usuario-exclusao'
  // Ler `webhook.pixnopdv_events`: o schema `webhook` não tem policy para o usuário
  // (`lib/pix-webhooks/events.functions.ts`). Só depois do gate de system_admin.
  | 'pix-eventos';

/**
 * Ponto ÚNICO de uso da service_role — modelo: `ServiceRole` da API do EasyFood.
 *
 * É ponto de OBSERVABILIDADE, não controle de segurança: não troca de role nem escopa nada.
 * O que ele garante é que toda escalação de privilégio seja (1) explícita no código, com um
 * motivo grepável, e (2) contada, para a dívida aparecer em vez de se espalhar em silêncio.
 *
 * O padrão de leitura continua sendo o cliente do USUÁRIO (user-supabase.ts), que passa
 * pela RLS exatamente como hoje.
 */
@Injectable()
export class ServiceRole {
  private readonly log = new Logger('service-role');
  private readonly counts = new Map<ServiceRoleReason, number>();

  constructor(private readonly admin: SupabaseAdmin) {}

  /** Única porta para operações privilegiadas. `reason` é grepável e contado. */
  async run<T>(reason: ServiceRoleReason, fn: (admin: SupabaseAdminClient) => Promise<T>): Promise<T> {
    this.counts.set(reason, (this.counts.get(reason) ?? 0) + 1);
    this.log.debug(`service_role: ${reason}`);
    return fn(this.admin.client);
  }

  /** Métrica de dívida: quantas escalações por motivo desde o boot. */
  stats(): Record<string, number> {
    return Object.fromEntries(this.counts);
  }
}
