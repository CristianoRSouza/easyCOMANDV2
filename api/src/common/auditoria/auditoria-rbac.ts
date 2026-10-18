import { Global, Injectable, Module } from '@nestjs/common';
import type { UserSupabaseClient } from '../../db/user-supabase';

export type EntradaDeAuditoria = {
  actor_id: string;
  action: string;
  entity: string;
  entity_id: string | null;
  payload: unknown;
};

/**
 * Gravação em `pv_rbac_audit_log` — o `audit(...)` repetido no topo de cada `*.functions.ts` de
 * hoje, escrito uma vez.
 *
 * Com o cliente do USUÁRIO (o `actor_id` é ele), e SEM conferir o erro, como hoje: a trilha de
 * auditoria nunca desfaz nem bloqueia a ação que já aconteceu. Se a RLS recusar a linha, a ação
 * fica sem registro — o mesmo comportamento de hoje, anotado em docs/decisoes-pendentes.md.
 */
@Injectable()
export class AuditoriaRbac {
  async registrar(db: UserSupabaseClient, entrada: EntradaDeAuditoria): Promise<void> {
    await db.from('pv_rbac_audit_log').insert({ ...entrada, payload: entrada.payload as never });
  }
}

@Global()
@Module({ providers: [AuditoriaRbac], exports: [AuditoriaRbac] })
export class AuditoriaModule {}
