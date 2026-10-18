/**
 * Pedaços de consulta que as telas de hoje repetem em todo lugar, escritos uma vez. Puros.
 */

/**
 * Filtro `.or(...)` de busca por e-mail OU nome (`ilike`), com o termo aparado. Vazio → `null`
 * (sem filtro). Hoje o termo vai CRU para o PostgREST — vírgula e parênteses no texto mudam o
 * filtro; mantido igual (ver docs/decisoes-pendentes.md).
 */
export function filtroEmailOuNome(termo: string | undefined): string | null {
  const t = termo?.trim();
  if (!t) return null;
  const like = `%${t}%`;
  return `email.ilike.${like},full_name.ilike.${like}`;
}

/** Janela `range(from, to)` da página (1-based), inclusiva nas duas pontas. */
export function janela(pagina: number, tamanho: number): { from: number; to: number } {
  const from = (pagina - 1) * tamanho;
  return { from, to: from + tamanho - 1 };
}
