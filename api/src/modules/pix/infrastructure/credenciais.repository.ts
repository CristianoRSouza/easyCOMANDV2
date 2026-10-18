import { Injectable } from '@nestjs/common';
import { noSchema } from '../../../db/billing-schema';
import { falhaDoBanco } from '../../../common/erros';
import type { UserSupabaseClient } from '../../../db/user-supabase';
import type { CredencialLinha, PixEnvironment } from '../domain/pix';

/**
 * `devices.pixnopdv_store_credentials` com o cliente do USUÁRIO — como hoje, "a RLS decide o que
 * cada usuário enxerga/edita — nada de service_role aqui" (credentials.functions.ts).
 *
 * Os segredos (basic_token, secret_key) são lidos aqui só para MASCARAR: nunca saem por extenso.
 */
@Injectable()
export class CredenciaisRepository {
  async listar(db: UserSupabaseClient): Promise<CredencialLinha[]> {
    const { data, error } = await noSchema(db, 'devices')
      .from('pixnopdv_store_credentials')
      .select('id,company_id,store_id,environment,api_base_url,basic_user,basic_token,secret_key,insecure_tls,enabled,updated_at');
    if (error) throw falhaDoBanco(error);
    return (data ?? []) as CredencialLinha[];
  }

  async gravar(db: UserSupabaseClient, patch: Record<string, unknown>): Promise<void> {
    const { error } = await noSchema(db, 'devices')
      .from('pixnopdv_store_credentials')
      .upsert(patch, { onConflict: 'company_id,store_id,environment' });
    if (error) throw falhaDoBanco(error);
  }

  async excluir(db: UserSupabaseClient, chave: { company_id: string; store_id: string; environment: PixEnvironment }): Promise<void> {
    const { error } = await noSchema(db, 'devices')
      .from('pixnopdv_store_credentials')
      .delete()
      .eq('company_id', chave.company_id)
      .eq('store_id', chave.store_id)
      .eq('environment', chave.environment);
    if (error) throw falhaDoBanco(error);
  }
}
