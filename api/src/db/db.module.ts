import { Global, Module } from '@nestjs/common';
import { ServiceRole } from './service-role';
import { SupabaseAdmin } from './supabase-admin';
import { SupabaseAuthVerifier } from './supabase-auth';
import { UserSupabaseFactory } from './user-supabase';

/**
 * Infra de dados global — só supabase-js, como no EasyControl de hoje.
 *
 *   • `UserSupabaseFactory`  — cliente do USUÁRIO (JWT da requisição → RLS). Padrão para tudo.
 *   • `ServiceRole`          — única porta para a service_role, sempre com motivo.
 *   • `SupabaseAuthVerifier` — `getClaims` do AuthGuard.
 *   • `SupabaseAdmin`        — o cliente privilegiado em si; exportado só para o `ServiceRole`
 *                              e para módulos de infraestrutura que o ESLint deixa passar.
 *
 * Sem `pg` de propósito (docs/arquitetura.md, "Acesso a dados"): o role de um pool direto teria
 * BYPASSRLS e mudaria a postura de segurança que hoje é garantida pelas policies.
 *
 * `database.types.ts` é cópia do arquivo GERADO pelo Supabase no EasyControl atual
 * (`src/integrations/supabase/types.ts`). Não editar à mão: regerar e copiar de novo.
 */
@Global()
@Module({
  providers: [SupabaseAdmin, ServiceRole, SupabaseAuthVerifier, UserSupabaseFactory],
  exports: [SupabaseAdmin, ServiceRole, SupabaseAuthVerifier, UserSupabaseFactory],
})
export class DbModule {}
