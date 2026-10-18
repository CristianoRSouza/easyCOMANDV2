import { afterEach, describe, expect, it, vi } from 'vitest';
import { criarClienteDoUsuario } from '../src/db/user-supabase';

/**
 * O que este teste protege: a consulta do usuário chega ao PostgREST COM o JWT dele.
 *
 * Se o `Authorization` não for junto, o supabase-js manda a própria chave publishable no lugar
 * — e o banco passa a ver um ANÔNIMO. Não dá erro: a RLS simplesmente devolve vazio, e a tela
 * mostra "nenhuma licença" para um cliente que paga. É o tipo de defeito que só aparece em
 * produção, por isso fica travado aqui.
 *
 * O `fetch` global é trocado por um espião: nada sai da máquina.
 */

const ENV = {
  SUPABASE_URL: 'https://projeto.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_falsa',
};

type Chamada = { url: string; headers: Headers };

function espiarFetch(): Chamada[] {
  const chamadas: Chamada[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (entrada: RequestInfo | URL, init?: RequestInit) => {
      chamadas.push({ url: String(entrada), headers: new Headers(init?.headers) });
      return new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } });
    }),
  );
  return chamadas;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('criarClienteDoUsuario — consultas passam pela RLS com o JWT do usuário', () => {
  it('o Authorization da consulta é o Bearer do usuário, não a chave publishable', async () => {
    const chamadas = espiarFetch();
    const db = criarClienteDoUsuario(ENV, 'jwt.do.usuario');

    await db.from('activity_logs').select('id').limit(1);

    expect(chamadas).toHaveLength(1);
    expect(chamadas[0].url).toContain('https://projeto.supabase.co/rest/v1/activity_logs');
    expect(chamadas[0].headers.get('authorization')).toBe('Bearer jwt.do.usuario');
    // A apikey continua sendo a publishable — é ela que identifica o projeto, não o usuário.
    expect(chamadas[0].headers.get('apikey')).toBe('sb_publishable_falsa');
  });

  it('RPC também vai com o JWT do usuário', async () => {
    const chamadas = espiarFetch();
    const db = criarClienteDoUsuario(ENV, 'jwt.do.usuario');

    await db.rpc('is_system_admin', { _user_id: '9f21a0b1-1111-4222-8333-444455556666' });

    expect(chamadas[0].headers.get('authorization')).toBe('Bearer jwt.do.usuario');
  });

  it('cada requisição tem o seu cliente: o token de um não vaza para o outro', async () => {
    const chamadas = espiarFetch();
    await criarClienteDoUsuario(ENV, 'jwt.de.ana').from('activity_logs').select('id');
    await criarClienteDoUsuario(ENV, 'jwt.de.bia').from('activity_logs').select('id');

    expect(chamadas.map((c) => c.headers.get('authorization'))).toEqual([
      'Bearer jwt.de.ana',
      'Bearer jwt.de.bia',
    ]);
  });
});
