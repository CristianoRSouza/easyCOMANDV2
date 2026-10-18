import 'reflect-metadata';
import { UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { describe, expect, it, vi } from 'vitest';
import { Public } from '../src/common/decorators';
import {
  AuthGuard,
  MSG_SEM_USUARIO,
  MSG_SESSAO_INVALIDA,
  extrairBearer,
} from '../src/common/guards/auth.guard';
import type { AuthenticatedRequest } from '../src/common/http/authenticated-request';
import type { JwtClaims, ResultadoClaims, SupabaseAuthVerifier } from '../src/db/supabase-auth';
import type { UserSupabaseClient, UserSupabaseFactory } from '../src/db/user-supabase';

/**
 * O que este teste protege: a porta de entrada de TODA rota não pública.
 *
 * As duas mensagens de 401 são as do `requireSupabaseAuth` do EasyControl atual — o BFF as
 * repassa à tela. Trocar uma vírgula aqui muda o que o usuário lê quando a sessão expira.
 *
 * O verificador e a fábrica são FAKES: nada aqui fala com o Supabase. O que se testa é a
 * decisão do guard sobre o que o `getClaims` devolveu.
 */

class Rotas {
  aberta() {}

  fechada() {}
}
// O MESMO `@Public()` das rotas reais, aplicado por chamada: decorator escrito num arquivo de
// teste não é transpilado (o tsconfig, que liga `experimentalDecorators`, só cobre `src/`).
Public()(Rotas.prototype, 'aberta', Object.getOwnPropertyDescriptor(Rotas.prototype, 'aberta')!);

const claimsValidas = (over: Partial<JwtClaims> = {}): JwtClaims => ({
  iss: 'https://exemplo.supabase.co/auth/v1',
  sub: '9f21a0b1-1111-4222-8333-444455556666',
  aud: 'authenticated',
  exp: 9_999_999_999,
  iat: 1_700_000_000,
  role: 'authenticated',
  aal: 'aal1',
  session_id: 'sessao-1',
  email: 'fulano@exemplo.com',
  ...over,
});

function montar(resultado: ResultadoClaims) {
  const verificar = vi.fn(async (_token: string) => resultado);
  const verifier = { verificar } as unknown as SupabaseAuthVerifier;
  const clienteFalso = { falso: true } as unknown as UserSupabaseClient;
  const paraToken = vi.fn((_token: string) => clienteFalso);
  const fabrica = { paraToken } as unknown as UserSupabaseFactory;
  const guard = new AuthGuard(new Reflector(), verifier, fabrica);
  return { guard, verificar, paraToken, clienteFalso };
}

function contexto(handler: keyof Rotas, headers: Record<string, string> = {}) {
  const req = { headers } as unknown as AuthenticatedRequest;
  const ctx = {
    getHandler: () => Rotas.prototype[handler],
    getClass: () => Rotas,
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
  return { ctx, req };
}

/** Executa e devolve o corpo do 401 (ou falha se não lançou 401). */
async function corpoDo401(p: Promise<unknown>): Promise<Record<string, unknown>> {
  try {
    await p;
  } catch (e) {
    expect(e).toBeInstanceOf(UnauthorizedException);
    return (e as UnauthorizedException).getResponse() as Record<string, unknown>;
  }
  throw new Error('esperava 401, a rota passou');
}

describe('AuthGuard — Bearer do Supabase validado com getClaims', () => {
  it('rota @Public() passa sem header e sem consultar o Supabase', async () => {
    const { guard, verificar } = montar({ claims: null, error: null });
    const { ctx } = contexto('aberta');
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(verificar).not.toHaveBeenCalled();
  });

  it('rota sem @Public() e sem Authorization → 401 com a mensagem de hoje', async () => {
    const { guard, verificar } = montar({ claims: claimsValidas(), error: null });
    const { ctx } = contexto('fechada');
    const corpo = await corpoDo401(guard.canActivate(ctx));
    expect(corpo).toEqual({ error: 'unauthorized', message: MSG_SESSAO_INVALIDA });
    expect(MSG_SESSAO_INVALIDA).toBe('Sessão inválida ou expirada. Faça login novamente.');
    // Sem token não há o que verificar: nem gasta a chamada.
    expect(verificar).not.toHaveBeenCalled();
  });

  it('Authorization que não é Bearer (ex.: Basic) → 401', async () => {
    const { guard } = montar({ claims: claimsValidas(), error: null });
    const { ctx } = contexto('fechada', { authorization: 'Basic dXNlcjpzZW5oYQ==' });
    expect((await corpoDo401(guard.canActivate(ctx))).message).toBe(MSG_SESSAO_INVALIDA);
  });

  it('Bearer inválido (getClaims devolve erro) → 401 sessão inválida', async () => {
    const { guard, verificar } = montar({
      claims: null,
      error: { message: 'invalid JWT', name: 'AuthInvalidJwtError' } as ResultadoClaims['error'],
    });
    const { ctx, req } = contexto('fechada', { authorization: 'Bearer token-forjado' });
    expect((await corpoDo401(guard.canActivate(ctx))).message).toBe(MSG_SESSAO_INVALIDA);
    expect(verificar).toHaveBeenCalledWith('token-forjado');
    expect(req.user).toBeUndefined();
  });

  it('getClaims sem erro mas sem claims → 401 sessão inválida', async () => {
    const { guard } = montar({ claims: null, error: null });
    const { ctx } = contexto('fechada', { authorization: 'Bearer qualquer' });
    expect((await corpoDo401(guard.canActivate(ctx))).message).toBe(MSG_SESSAO_INVALIDA);
  });

  it('claims sem `sub` → 401 com a SEGUNDA mensagem de hoje', async () => {
    const { guard } = montar({ claims: claimsValidas({ sub: '' }), error: null });
    const { ctx, req } = contexto('fechada', { authorization: 'Bearer sem-sub' });
    const corpo = await corpoDo401(guard.canActivate(ctx));
    expect(corpo).toEqual({ error: 'unauthorized', message: MSG_SEM_USUARIO });
    expect(MSG_SEM_USUARIO).toBe('Não foi possível identificar o usuário. Faça login novamente.');
    expect(req.user).toBeUndefined();
  });

  it('Bearer válido → passa e popula user, token cru e cliente do usuário', async () => {
    const claims = claimsValidas();
    const { guard, paraToken, clienteFalso } = montar({ claims, error: null });
    const { ctx, req } = contexto('fechada', { authorization: 'Bearer jwt.valido.assinado' });

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(req.user).toEqual({ id: claims.sub, claims });
    expect(req.accessToken).toBe('jwt.valido.assinado');

    // O cliente é preguiçoso: só nasce quando alguém pede, e nasce UMA vez por requisição.
    expect(paraToken).not.toHaveBeenCalled();
    expect(req.supabaseDoUsuario()).toBe(clienteFalso);
    expect(req.supabaseDoUsuario()).toBe(clienteFalso);
    expect(paraToken).toHaveBeenCalledTimes(1);
    expect(paraToken).toHaveBeenCalledWith('jwt.valido.assinado');
  });

  it('o prefixo "bearer" é aceito sem diferenciar maiúsculas', async () => {
    const { guard } = montar({ claims: claimsValidas(), error: null });
    const { ctx } = contexto('fechada', { authorization: 'bearer jwt.valido.assinado' });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });
});

describe('extrairBearer', () => {
  it('extrai o token e recusa formatos tortos', () => {
    expect(extrairBearer('Bearer abc.def.ghi')).toBe('abc.def.ghi');
    expect(extrairBearer(['Bearer abc'])).toBe('abc');
    expect(extrairBearer('Bearer ')).toBeNull();
    expect(extrairBearer('Bearer a b')).toBeNull();
    expect(extrairBearer('abc')).toBeNull();
    expect(extrairBearer(undefined)).toBeNull();
  });
});
