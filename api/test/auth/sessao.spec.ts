import { describe, expect, it, vi } from 'vitest';
import { LoginUseCase, MeUseCase } from '../../src/modules/auth/application/sessao.use-cases';
import { paraAdminUser } from '../../src/modules/auth/domain/sessao';
import type { PapelAdminReader } from '../../src/modules/auth/infrastructure/papel-admin.reader';
import type { SupabaseAuthGateway } from '../../src/modules/auth/infrastructure/supabase-auth.gateway';
import type { UserSupabaseClient } from '../../src/db/user-supabase';

const SESSAO = { access_token: 'at', refresh_token: 'rt', expires_at: 2_000_000_000 };
const USUARIO = { id: 'u1', email: 'ana@easysoft.com', user_metadata: { full_name: 'Ana Souza' } };

function gateway(entrar: Awaited<ReturnType<SupabaseAuthGateway['entrarComSenha']>>) {
  return {
    entrarComSenha: vi.fn().mockResolvedValue(entrar),
    encerrar: vi.fn().mockResolvedValue({ ok: true, valor: null }),
  } as unknown as SupabaseAuthGateway & { encerrar: ReturnType<typeof vi.fn> };
}

const papel = (valor: 'system_admin' | 'tech_admin' | false | null) =>
  ({ doToken: vi.fn().mockResolvedValue(valor), doCliente: vi.fn().mockResolvedValue(valor) }) as unknown as PapelAdminReader;

const statusDe = async (p: Promise<unknown>) => {
  const e = (await p.catch((x: unknown) => x)) as { getStatus(): number; getResponse(): { message: string } };
  return { status: e.getStatus(), message: e.getResponse().message };
};

describe('login', () => {
  it('admin entra e recebe o AdminUser de hoje (nome do full_name)', async () => {
    const r = await new LoginUseCase(gateway({ ok: true, valor: { session: SESSAO, user: USUARIO } }), papel('tech_admin')).execute({
      email: 'ana@easysoft.com',
      password: 'x',
    });
    expect(r).toEqual({ session: SESSAO, user: { id: 'u1', email: 'ana@easysoft.com', name: 'Ana Souza', role: 'tech_admin' } });
  });

  it('credencial errada: 400 com o texto CRU do Supabase (a tela de hoje o mostra assim)', async () => {
    const uc = new LoginUseCase(gateway({ ok: false, erro: 'Invalid login credentials' }), papel('system_admin'));
    expect(await statusDe(uc.execute({ email: 'a', password: 'b' }))).toEqual({ status: 400, message: 'Invalid login credentials' });
  });

  it.each([false, null] as const)('papel %s: encerra a sessão recém-criada e responde 403 "Acesso restrito…"', async (valor) => {
    const gw = gateway({ ok: true, valor: { session: SESSAO, user: USUARIO } });
    const uc = new LoginUseCase(gw, papel(valor));
    expect(await statusDe(uc.execute({ email: 'a', password: 'b' }))).toEqual({
      status: 403,
      message: 'Acesso restrito à equipe técnica EasySoft.',
    });
    expect(gw.encerrar).toHaveBeenCalledWith('at');
  });
});

describe('me (revalidação a cada carga de página)', () => {
  const db = {} as UserSupabaseClient;

  it('deixou de ser admin: encerra a sessão e 403', async () => {
    const gw = gateway({ ok: true, valor: null });
    expect(await statusDe(new MeUseCase(gw, papel(false)).execute(db, USUARIO, 'at'))).toMatchObject({ status: 403 });
    expect(gw.encerrar).toHaveBeenCalledWith('at');
  });

  it('erro na leitura do papel: 503 (a tela mantém o usuário, como o "otimista" de hoje)', async () => {
    const gw = gateway({ ok: true, valor: null });
    expect(await statusDe(new MeUseCase(gw, papel(null)).execute(db, USUARIO, 'at'))).toMatchObject({ status: 503 });
    expect(gw.encerrar).not.toHaveBeenCalled();
  });
});

describe('paraAdminUser', () => {
  it('nome: full_name → name → parte local do e-mail → "admin"', () => {
    expect(paraAdminUser({ id: 'u', email: 'x@y', user_metadata: { name: 'Bia' } }, 'tech_admin').name).toBe('Bia');
    expect(paraAdminUser({ id: 'u', email: 'carlos@y', user_metadata: {} }, 'tech_admin').name).toBe('carlos');
    expect(paraAdminUser({ id: 'u', email: null, user_metadata: null }, 'tech_admin')).toEqual({
      id: 'u',
      email: '',
      name: 'admin',
      role: 'tech_admin',
    });
  });
});
