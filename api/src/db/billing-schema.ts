import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

/**
 * Schemas que NÃO estão no `database.types.ts` gerado (o arquivo é cópia do EasyControl atual e
 * só traz `public`): `billing`, `connect`, `devices` e `webhook`. Hoje o código contorna caso a
 * caso com `.schema("billing" as never).from("<tabela>" as never)`; este helper é esse mesmo
 * contorno, escrito uma vez.
 *
 * O cliente devolvido é SEM TIPO de linha: quem consulta declara o formato do que espera e trata
 * o resto como `unknown`.
 *
 * NÃO muda privilégio: devolve o mesmo cliente que recebeu (usuário → RLS; admin → service_role),
 * só apontado para o schema pedido.
 */
export type SchemaExtra = 'billing' | 'connect' | 'devices' | 'webhook';

export function noSchema(db: SupabaseClient<Database>, schema: SchemaExtra) {
  return (db as unknown as SupabaseClient).schema(schema);
}
