import {
  createParamDecorator,
  InternalServerErrorException,
  type ExecutionContext,
} from '@nestjs/common';
import type { JwtClaims } from '../../db/supabase-auth';
import type { UserSupabaseClient } from '../../db/user-supabase';
import type { AuthenticatedRequest } from './authenticated-request';

/**
 * Parâmetros que saem do que o `AuthGuard` já validou — nunca do cliente.
 *
 *     status(@UserId() userId: string, @UserSupabase() db: UserSupabaseClient, @Query(...) q)
 *
 * em vez de `@Req() req` + `req.user!.id`. O controller deixa de conhecer o formato da
 * requisição e o `!` (que só afirmava, sem conferir) some.
 *
 * Todos FALHAM com 500 se o valor não estiver lá. Isso só acontece por erro de programação —
 * uma rota `@Public()` pedindo o usuário — e nesse caso um 500 visível é melhor do que uma
 * consulta rodando com `undefined` no lugar do dono da sessão.
 */

const requisicao = (ctx: ExecutionContext) =>
  ctx.switchToHttp().getRequest<Partial<AuthenticatedRequest>>();

const CAUSA = 'a rota é @Public()?';

function exigir<T>(valor: T | null | undefined, decorator: string): T {
  if (valor === null || valor === undefined) {
    throw new InternalServerErrorException(`${decorator} sem valor na requisição: ${CAUSA}`);
  }
  return valor;
}

/** Dono da sessão (`sub` do JWT). */
export const UserId = createParamDecorator((_: unknown, ctx: ExecutionContext): string =>
  exigir(requisicao(ctx).user?.id, '@UserId()'),
);

/** Claims verificadas do JWT (email, role, aal…). */
export const UserClaims = createParamDecorator((_: unknown, ctx: ExecutionContext): JwtClaims =>
  exigir(requisicao(ctx).user?.claims, '@UserClaims()'),
);

/**
 * O JWT cru. Para os poucos casos em que o módulo precisa repassá-lo (ex.: `auth/logout`
 * revogando a sessão). Para consultar o banco, prefira `@UserSupabase()`.
 */
export const AccessToken = createParamDecorator((_: unknown, ctx: ExecutionContext): string =>
  exigir(requisicao(ctx).accessToken, '@AccessToken()'),
);

/** Cliente Supabase do usuário, já com o JWT no `Authorization` — as consultas passam pela RLS. */
export const UserSupabase = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): UserSupabaseClient =>
    exigir(requisicao(ctx).supabaseDoUsuario, '@UserSupabase()')(),
);
