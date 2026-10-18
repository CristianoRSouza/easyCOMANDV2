import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { ConfigModule } from './config/config.module';
import { ENV, type Env } from './config/env';
import { DbModule } from './db/db.module';
import { SessionThrottlerGuard } from './common/guards/session-throttler.guard';
import { AuthGuard } from './common/guards/auth.guard';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { AutorizacaoModule } from './common/autorizacao';
import { AuditoriaModule } from './common/auditoria/auditoria-rbac';
import { HealthModule } from './modules/health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { UserCompanyAccessModule } from './modules/user-company-access/user-company-access.module';
import { RbacModule } from './modules/rbac/rbac.module';
import { MenusModule } from './modules/menus/menus.module';
import { PixModule } from './modules/pix/pix.module';
import { BillingModule } from './modules/billing/billing.module';
import { EmpresasModule } from './modules/empresas/empresas.module';
import { PainelModule } from './modules/painel/painel.module';
import { AuditoriaTelasModule } from './modules/auditoria/auditoria.module';

/**
 * Módulo raiz. Throttler e AuthGuard são GLOBAIS: toda rota (menos `@Public`) exige o JWT do
 * Supabase em `Authorization: Bearer`, e todo erro sai no envelope padrão.
 */
@Module({
  imports: [
    ConfigModule,
    // Rate-limit global contado por SESSÃO (ver SessionThrottlerGuard); anônimo cai no IP.
    ThrottlerModule.forRootAsync({
      inject: [ENV],
      useFactory: (env: Env) => [{ ttl: env.RATE_LIMIT_TTL_SECONDS * 1000, limit: env.RATE_LIMIT_LIMIT }],
    }),
    DbModule,
    // Núcleo compartilhado, GLOBAL (nenhum módulo de negócio precisa importá-los):
    //   AutorizacaoModule → os gates de administrador (legado, system_admin, company_admin, menus)
    //   AuditoriaModule   → a gravação em pv_rbac_audit_log
    AutorizacaoModule,
    AuditoriaModule,
    HealthModule,
    // Módulos de negócio — um por área do Control Center.
    AuthModule,
    UsersModule,
    UserCompanyAccessModule,
    RbacModule,
    MenusModule,
    PixModule,
    BillingModule,
    EmpresasModule,
    PainelModule,
    AuditoriaTelasModule,
  ],
  providers: [
    // ORDEM IMPORTA — rodam nesta sequência:
    //   1. rate-limit   (antes de autenticar: requisição abusiva não deve custar verificação)
    //   2. autenticação (popula req.user / req.accessToken / req.supabaseDoUsuario)
    // A autorização de administrador NÃO é guard global: os gates variam por ação (como hoje) e
    // cada caso de uso chama o seu (AutorizacaoService).
    { provide: APP_GUARD, useClass: SessionThrottlerGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
  ],
})
export class AppModule {}
