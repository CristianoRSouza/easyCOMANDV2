/**
 * Erros de regra de negócio — PUROS (sem Nest), para o domain e a application lançarem sem
 * conhecer HTTP. Quem traduz para status é o `HttpExceptionFilter`.
 *
 * Por que existe: no EasyControl de hoje as server functions fazem `throw new Error("<texto>")` e
 * o TanStack Start leva o TEXTO até a tela, que o mostra num toast ou num banner. Na V2 o texto
 * viaja no `message` do envelope de erro; o BFF o repassa e a tela mostra o mesmo texto. Um
 * `Error` comum, ao contrário, vira 500 "Erro interno." — então TODO erro que a tela de hoje
 * exibe tem que sair daqui.
 *
 *   proibido        → 403  ("Permissão negada — requer system_admin.")
 *   invalido        → 400  (regra violada: "Roles de sistema não podem ser excluídas.")
 *   nao_encontrado  → 404  ("Usuário não encontrado.")
 *   conflito        → 409  ("Esse usuário já possui vínculo com essa empresa.")
 *   banco           → 400  (o PostgREST recusou; hoje a tela mostra o texto cru do Supabase)
 *   externo         → 502  (Stripe, EasyERP-API, Edge Function)
 */
export type TipoDeErro = 'proibido' | 'invalido' | 'nao_encontrado' | 'conflito' | 'banco' | 'externo';

export class ErroDeRegra extends Error {
  constructor(
    message: string,
    readonly tipo: TipoDeErro = 'invalido',
    /** Código estável opcional (ex.: o `error` que a EasyERP-API devolveu). */
    readonly codigo?: string,
    /** Detalhes que a tela usa (ex.: `company_ids` de uma credencial ambígua). */
    readonly detalhes?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ErroDeRegra';
  }
}

export const proibido = (mensagem = 'Permissão negada') => new ErroDeRegra(mensagem, 'proibido');
export const invalido = (mensagem: string) => new ErroDeRegra(mensagem, 'invalido');
export const naoEncontrado = (mensagem: string) => new ErroDeRegra(mensagem, 'nao_encontrado');
export const conflito = (mensagem: string) => new ErroDeRegra(mensagem, 'conflito');

/** Forma mínima de um erro do PostgREST/supabase-js. */
export type ErroPostgrest = {
  message?: unknown;
  details?: unknown;
  hint?: unknown;
  code?: unknown;
};

/**
 * Recusa do banco com o texto que a tela de hoje mostra: o `error.message` cru do supabase-js
 * (`throw new Error(error.message)` nas server functions).
 */
export function falhaDoBanco(erro: ErroPostgrest): ErroDeRegra {
  const texto = typeof erro.message === 'string' && erro.message ? erro.message : 'Falha ao consultar o banco.';
  return new ErroDeRegra(texto, 'banco', typeof erro.code === 'string' ? erro.code : undefined);
}
