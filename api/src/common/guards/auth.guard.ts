import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC } from '../decorators';
import { SupabaseAuthVerifier } from '../../db/supabase-auth';
import { UserSupabaseFactory, type UserSupabaseClient } from '../../db/user-supabase';
import type { AuthenticatedRequest } from '../http/authenticated-request';

/**
 * Mensagens do 401. O `requireSupabaseAuth` de hoje (`easyCONTROL/src/integrations/supabase/
 * auth-middleware.ts`) respondia em inglês ("Unauthorized: Invalid token") e a tela nunca mostrava
 * o texto: sessão inválida derruba para o login. Na V2 é o BFF quem faz isso ao ver o 401 — o
 * texto só aparece em log e no Swagger, por isso fica em português, como o resto da API.
 */
export const MSG_SESSAO_INVALIDA = 'Sessão inválida ou expirada. Faça login novamente.';
export const MSG_SEM_USUARIO = 'Não foi possível identificar o usuário. Faça login novamente.';

/** `Authorization: Bearer <token>` → token; qualquer outra coisa → `null`. */
export function extrairBearer(header: unknown): string | null {
  const valor = Array.isArray(header) ? header[0] : header;
  if (typeof valor !== 'string') return null;
  const m = /^Bearer\s+(\S+)\s*$/i.exec(valor.trim());
  return m ? m[1] : null;
}

/**
 * Autenticação global.
 *
 *   `@Public()` → libera.
 *   o resto     → exige `Authorization: Bearer <access_token do Supabase>`, validado com
 *                 `getClaims` — a MESMA checagem de hoje. O token vem do BFF do Next, que o
 *                 guarda em cookie httpOnly; o navegador nunca o vê.
 *
 * Ordem das recusas igual à de hoje:
 *   1. sem token, token inválido/expirado, ou erro do `getClaims` → MSG_SESSAO_INVALIDA;
 *   2. claims sem `sub`                                        → MSG_SEM_USUARIO.
 *
 * Nota: como hoje, uma falha do `getClaims` por rede (JWKS fora do ar) também vira 401. Não é
 * o ideal — um blip do Auth "desloga" o usuário —, mas mudar isso é mudar comportamento e fica
 * registrado como decisão a tomar, não como efeito colateral da migração.
 *
 * Popula `req.user = { id, claims }`, `req.accessToken` (o JWT cru) e
 * `req.supabaseDoUsuario()` (cliente com RLS) — lidos pelos decorators de `request.decorators.ts`.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  private readonly log = new Logger('auth');

  constructor(
    private readonly reflector: Reflector,
    private readonly verifier: SupabaseAuthVerifier,
    private readonly usuarios: UserSupabaseFactory,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const publica = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (publica) return true;

    const req = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = extrairBearer(req.headers?.authorization);
    if (!token) throw naoAutorizado(MSG_SESSAO_INVALIDA);

    const { claims, error } = await this.verifier.verificar(token);
    if (error || !claims) {
      // Só o motivo — nunca o token. O 401 em si já sai na linha da requisição (request-log).
      this.log.debug(`getClaims recusou o token: ${error?.message ?? 'sem claims'}`);
      throw naoAutorizado(MSG_SESSAO_INVALIDA);
    }
    if (!claims.sub) {
      this.log.warn('JWT válido mas sem `sub` nas claims');
      throw naoAutorizado(MSG_SEM_USUARIO);
    }

    req.user = { id: claims.sub, claims };
    req.accessToken = token;
    let cliente: UserSupabaseClient | undefined;
    req.supabaseDoUsuario = () => (cliente ??= this.usuarios.paraToken(token));
    return true;
  }
}

function naoAutorizado(message: string): UnauthorizedException {
  return new UnauthorizedException({ error: 'unauthorized', message });
}
