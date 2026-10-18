import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { MSG_SESSAO_INVALIDA } from '../../../common/guards/auth.guard';
import type { UserSupabaseClient } from '../../../db/user-supabase';
import { MSG_ACESSO_RESTRITO, MSG_RENOVACAO_INDISPONIVEL } from '../domain/mensagens';
import { paraAdminUser, type AdminUser, type Identidade, type SessaoDto } from '../domain/sessao';
import type { Credentials } from '../dto/auth.schemas';
import { PapelAdminReader } from '../infrastructure/papel-admin.reader';
import { SupabaseAuthGateway } from '../infrastructure/supabase-auth.gateway';

/**
 * Login, renovação, logout e "quem sou eu" — o `AuthProvider` de hoje
 * (`easyCONTROL/src/lib/auth-context.tsx`), que rodava no NAVEGADOR com a sessão no
 * localStorage. Agora roda aqui; o BFF guarda a sessão em cookie httpOnly.
 */

const erro = (status: number, error: string, message: string) => new HttpException({ error, message }, status);

@Injectable()
export class LoginUseCase {
  private readonly log = new Logger('auth:login');

  constructor(
    private readonly auth: SupabaseAuthGateway,
    private readonly papeis: PapelAdminReader,
  ) {}

  /**
   * Mesma sequência de hoje:
   *   1. `signInWithPassword` — erro → o texto CRU do Supabase (a tela de hoje o mostra assim);
   *   2. sem usuário → "Acesso restrito…";
   *   3. papel: não-admin OU erro na leitura → encerra a sessão recém-criada e "Acesso restrito…".
   *
   * Status 400 para credencial errada (e não 401): no BFF, 401 significa "sessão inválida, apague
   * os cookies"; 403 para quem entrou mas não é da equipe técnica.
   */
  async execute(dados: Credentials): Promise<{ session: SessaoDto; user: AdminUser }> {
    const r = await this.auth.entrarComSenha(dados.email, dados.password);
    if (!r.ok) {
      this.log.warn(`[signInWithPassword] ${r.erro}`);
      throw erro(HttpStatus.BAD_REQUEST, 'auth_failed', r.erro);
    }
    if (!r.valor) throw erro(HttpStatus.FORBIDDEN, 'access_denied', MSG_ACESSO_RESTRITO);

    const { session, user } = r.valor;
    const papel = await this.papeis.doToken(session.access_token, user.id);
    if (papel === false || papel === null) {
      const saida = await this.auth.encerrar(session.access_token);
      if (!saida.ok) this.log.error(`[signOut após recusa] ${saida.erro}`);
      throw erro(HttpStatus.FORBIDDEN, 'access_denied', MSG_ACESSO_RESTRITO);
    }
    return { session, user: paraAdminUser(user, papel) };
  }
}

@Injectable()
export class RefreshUseCase {
  private readonly log = new Logger('auth:refresh');

  constructor(private readonly auth: SupabaseAuthGateway) {}

  /**
   * 401 = o refresh token não vale mais (o BFF apaga os cookies); 503 = falha transitória do
   * Auth (o BFF mantém a sessão enquanto o access token valer).
   */
  async execute(refreshToken: string): Promise<{ session: SessaoDto }> {
    const r = await this.auth.renovar(refreshToken);
    if (!r.ok) {
      this.log.warn(`[refreshSession] ${r.erro}`);
      if (r.retentavel) throw erro(HttpStatus.SERVICE_UNAVAILABLE, 'auth_unavailable', MSG_RENOVACAO_INDISPONIVEL);
      throw erro(HttpStatus.UNAUTHORIZED, 'unauthorized', MSG_SESSAO_INVALIDA);
    }
    return { session: r.valor };
  }
}

@Injectable()
export class LogoutUseCase {
  private readonly log = new Logger('auth:logout');

  constructor(private readonly auth: SupabaseAuthGateway) {}

  /** Falha aqui não trava o logout: o BFF apaga os cookies de qualquer jeito. Só registra. */
  async execute(accessToken: string): Promise<void> {
    const r = await this.auth.encerrar(accessToken);
    if (!r.ok) this.log.error(`[signOut] ${r.erro}`);
  }
}

@Injectable()
export class MeUseCase {
  private readonly log = new Logger('auth:me');

  constructor(
    private readonly auth: SupabaseAuthGateway,
    private readonly papeis: PapelAdminReader,
  ) {}

  /**
   * A revalidação que o `AuthProvider` de hoje faz a cada carga de página (`verify`):
   *   • admin           → o `AdminUser`;
   *   • não-admin       → encerra a sessão e 403 (o BFF apaga os cookies e manda para o login);
   *   • erro na leitura → 503: a tela mantém o usuário que já tinha (o "otimista" de hoje).
   */
  async execute(db: UserSupabaseClient, identidade: Identidade, accessToken: string): Promise<{ user: AdminUser }> {
    const papel = await this.papeis.doCliente(db, identidade.id);
    if (papel === null) {
      throw erro(HttpStatus.SERVICE_UNAVAILABLE, 'role_lookup_failed', 'Não foi possível confirmar o acesso agora.');
    }
    if (papel === false) {
      const saida = await this.auth.encerrar(accessToken);
      if (!saida.ok) this.log.error(`[signOut de não-admin] ${saida.erro}`);
      throw erro(HttpStatus.FORBIDDEN, 'access_denied', MSG_ACESSO_RESTRITO);
    }
    return { user: paraAdminUser(identidade, papel) };
  }
}
