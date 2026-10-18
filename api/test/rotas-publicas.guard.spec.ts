import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { IS_PUBLIC } from '../src/common/decorators';

/**
 * Guard de ROTAS ABERTAS — quebra o build antes de uma rota pública nova passar despercebida.
 *
 * O `AuthGuard` é fechado por padrão: sem `@Public()`, a rota exige o JWT do usuário. Esse
 * padrão só vale enquanto abrir uma rota for uma decisão VISÍVEL. Este teste carrega todos os
 * controllers de `src/modules/`, lê a marca `isPublic` de cada rota e compara com a lista
 * abaixo, onde cada rota aberta tem que explicar por que é aberta.
 *
 * ── Como ler uma falha ─────────────────────────────────────────────────────────
 *   • "rota pública fora da lista": alguém pôs `@Public()` numa rota. Se for intencional
 *     (login, cadastro, webhook do Stripe…), acrescente aqui COM o motivo — quem revisa vê.
 *   • "rota da lista não é mais pública": a lista ficou velha; tire a entrada.
 *   • "@Public() na CLASSE": proibido. Marca na classe abre toda rota futura do controller
 *     sem ninguém perceber; abra rota a rota.
 */
const ROTAS_DA_FUNDACAO: Record<string, string> = {
  'GET /health/live': 'liveness do orquestrador — não pode depender de sessão nem de Supabase',
  'GET /health': 'health público mínimo, mesmo corpo do liveness, sem métrica interna',
};

/**
 * Cada módulo de negócio declara as SUAS rotas abertas em `test/rotas-publicas/<modulo>.ts`.
 * Um arquivo por módulo para que módulos escritos em paralelo não disputem esta lista.
 */
const PASTA_DAS_LISTAS = join(dirname(fileURLToPath(import.meta.url)), 'rotas-publicas');

async function carregarListaPublica(): Promise<Record<string, string>> {
  const total: Record<string, string> = { ...ROTAS_DA_FUNDACAO };
  for (const nome of readdirSync(PASTA_DAS_LISTAS)) {
    if (!nome.endsWith('.ts')) continue;
    const mod = (await import(pathToFileURL(join(PASTA_DAS_LISTAS, nome)).href)) as {
      ROTAS_PUBLICAS?: Record<string, string>;
    };
    for (const [rota, motivo] of Object.entries(mod.ROTAS_PUBLICAS ?? {})) {
      if (rota in total) throw new Error(`rota pública declarada duas vezes: ${rota} (${nome})`);
      total[rota] = motivo;
    }
  }
  return total;
}

const METODOS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'ALL', 'OPTIONS', 'HEAD', 'SEARCH'];
const MODULOS = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'modules');

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (p.endsWith('.controller.ts')) out.push(p);
  }
  return out;
}

const junta = (...partes: unknown[]) =>
  '/' +
  partes
    .flatMap((p) => String(p ?? '').split('/'))
    .filter(Boolean)
    .join('/');
const lista = (v: unknown): unknown[] => (Array.isArray(v) ? v : [v]);

type Rota = { rota: string; publica: boolean; arquivo: string };

async function carregarRotas(): Promise<{ rotas: Rota[]; classesPublicas: string[] }> {
  const rotas: Rota[] = [];
  const classesPublicas: string[] = [];
  for (const arquivo of walk(MODULOS)) {
    const mod = (await import(pathToFileURL(arquivo).href)) as Record<string, unknown>;
    for (const exportado of Object.values(mod)) {
      if (typeof exportado !== 'function') continue;
      const bases = Reflect.getMetadata('path', exportado);
      if (bases === undefined) continue; // não é controller
      const rel = relative(MODULOS, arquivo).replace(/\\/g, '/');
      if (Reflect.getMetadata(IS_PUBLIC, exportado)) classesPublicas.push(`${rel} → ${exportado.name}`);

      const proto = (exportado as { prototype: Record<string, unknown> }).prototype;
      for (const nome of Object.getOwnPropertyNames(proto)) {
        const handler = proto[nome];
        if (nome === 'constructor' || typeof handler !== 'function') continue;
        const metodo = Reflect.getMetadata('method', handler);
        if (metodo === undefined) continue;
        for (const base of lista(bases)) {
          for (const sub of lista(Reflect.getMetadata('path', handler) ?? '')) {
            rotas.push({
              rota: `${METODOS[metodo] ?? metodo} ${junta(base, sub)}`,
              publica: Reflect.getMetadata(IS_PUBLIC, handler) === true,
              arquivo: rel,
            });
          }
        }
      }
    }
  }
  return { rotas, classesPublicas };
}

// Carrega TODOS os controllers por import dinâmico: com a suíte inteira rodando em paralelo isso
// passa dos 5 s padrão do vitest. O teste é lento por natureza, não travado — daí o prazo maior.
describe('Rotas abertas exigem @Public() explícito e registrado', { timeout: 60_000 }, () => {
  it('sanidade: achou controllers e rotas (não é no-op)', async () => {
    const { rotas } = await carregarRotas();
    expect(rotas.length).toBeGreaterThan(0);
  });

  it('nenhum controller marca @Public() na classe inteira', async () => {
    const { classesPublicas } = await carregarRotas();
    expect(classesPublicas, 'Abra rota a rota, não o controller inteiro').toEqual([]);
  });

  it('o conjunto de rotas públicas é exatamente o da lista', async () => {
    const { rotas } = await carregarRotas();
    const ROTAS_PUBLICAS = await carregarListaPublica();
    const publicas = rotas.filter((r) => r.publica);

    const foraDaLista = publicas
      .filter((r) => !(r.rota in ROTAS_PUBLICAS))
      .map((r) => `${r.rota}  (${r.arquivo})`);
    expect(
      foraDaLista,
      'Rota pública fora da lista. Se é intencional, registre-a em test/rotas-publicas/<modulo>.ts com o motivo.',
    ).toEqual([]);

    const abertas = new Set(publicas.map((r) => r.rota));
    const velhas = Object.keys(ROTAS_PUBLICAS).filter((r) => !abertas.has(r));
    expect(velhas, 'Rota da lista não é mais pública (ou sumiu) — tire a entrada.').toEqual([]);
  });

  it('toda entrada da lista tem justificativa de verdade', async () => {
    for (const [rota, motivo] of Object.entries(await carregarListaPublica())) {
      expect(motivo.length, `${rota} sem justificativa`).toBeGreaterThan(20);
    }
  });
});
