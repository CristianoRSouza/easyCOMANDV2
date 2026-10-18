import type { UserSupabaseClient } from '../../src/db/user-supabase';

/**
 * Fake do supabase-js para testar repositórios e casos de uso SEM rede: cada consulta vira um
 * registro com a tabela, a OPERAÇÃO (select/insert/update/delete/upsert/rpc) e a cadeia de
 * filtros na ordem em que foi montada. O `responder` decide o que cada consulta devolve.
 *
 * Qualquer método encadeável (eq, in, or, order, range, limit, gte, lte, lt, ilike…) é aceito e
 * gravado — o teste confere o que importa, não a sintaxe exata.
 */
export type Passo = { metodo: string; args: unknown[] };

export type Consulta = {
  schema: string;
  tabela: string;
  operacao: 'select' | 'insert' | 'update' | 'delete' | 'upsert' | 'rpc';
  valores?: unknown;
  passos: Passo[];
  terminal: 'lista' | 'single' | 'maybeSingle';
};

export type Resposta = { data?: unknown; error?: { message: string; code?: string } | null; count?: number | null };
export type Responder = (c: Consulta) => Resposta | Error;

const OPERACOES = new Set(['select', 'insert', 'update', 'delete', 'upsert']);

export function fakeSupabase(responder: Responder = () => ({ data: [] })) {
  const consultas: Consulta[] = [];

  const executar = (c: Consulta): Promise<Required<Pick<Resposta, 'data' | 'error'>> & { count: number | null }> => {
    consultas.push(c);
    const r = responder(c);
    if (r instanceof Error) return Promise.reject(r);
    // `single`/`maybeSingle` sem linha devolvem `null`, não `[]` — como o supabase-js.
    const vazio = c.terminal !== 'lista' && Array.isArray(r.data) && r.data.length === 0;
    return Promise.resolve({ data: vazio ? null : (r.data ?? null), error: r.error ?? null, count: r.count ?? null });
  };

  const builder = (schema: string, tabela: string) => {
    const c: Omit<Consulta, 'terminal'> = { schema, tabela, operacao: 'select', passos: [] };
    let definiuOperacao = false;
    const proxy: Record<string, unknown> = new Proxy(
      {},
      {
        get(_alvo, prop: string) {
          if (prop === 'then') {
            return (ok: (r: unknown) => unknown, falha?: (e: unknown) => unknown) =>
              executar({ ...c, terminal: 'lista' }).then(ok, falha);
          }
          if (prop === 'single' || prop === 'maybeSingle') {
            return () => executar({ ...c, terminal: prop });
          }
          return (...args: unknown[]) => {
            if (OPERACOES.has(prop) && !definiuOperacao) {
              definiuOperacao = true;
              c.operacao = prop as Consulta['operacao'];
              if (prop !== 'select' && prop !== 'delete') c.valores = args[0];
            }
            c.passos.push({ metodo: prop, args });
            return proxy;
          };
        },
      },
    );
    return proxy;
  };

  const cliente = {
    from: (tabela: string) => builder('public', tabela),
    schema: (schema: string) => ({ from: (tabela: string) => builder(schema, tabela) }),
    rpc: (nome: string, args?: unknown) =>
      executar({ schema: 'public', tabela: nome, operacao: 'rpc', valores: args, passos: [], terminal: 'lista' }),
  };

  return { db: cliente as unknown as UserSupabaseClient, consultas };
}

/** Argumento de um passo `eq(coluna, valor)` gravado. */
export const valorDoEq = (c: Consulta, coluna: string) =>
  c.passos.find((p) => p.metodo === 'eq' && p.args[0] === coluna)?.args[1];

export const temPasso = (c: Consulta, metodo: string) => c.passos.some((p) => p.metodo === metodo);
