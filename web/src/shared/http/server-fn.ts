/**
 * Ponte com o formato das telas de hoje: no TanStack Start elas chamavam server functions com
 * `useServerFn(fn)` e `fn({ data })`. Aqui as "server functions" são os adaptadores de
 * `modules/<x>/infrastructure`, que traduzem cada chamada numa rota REST da API — e o
 * `useServerFn` vira identidade. Assim o JSX e os hooks das telas ficam como estão.
 */
export function useServerFn<F>(fn: F): F {
  return fn;
}

/** Forma de chamada das server functions de hoje: um objeto com `data`. */
export type ChamadaComData<T> = { data: T };
