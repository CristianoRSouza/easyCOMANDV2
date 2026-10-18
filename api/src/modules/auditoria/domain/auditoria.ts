/** Regras puras das telas de auditoria (`_admin.audit.tsx`, `_admin.permission-audit.tsx`, `EasyFoodPayAuditCard`). */

/** Busca livre do log de atividade: em ação, categoria, autor, entidade e resumo. */
export function filtroDeAtividade(termo: string | undefined): string | null {
  const t = termo?.trim();
  if (!t) return null;
  const like = `%${t}%`;
  return `action.ilike.${like},category.ilike.${like},user_email.ilike.${like},entity_type.ilike.${like},summary.ilike.${like}`;
}

/**
 * Filtros da auditoria de permissões. O período chega PRONTO em ISO (`from_iso`/`to_iso`): hoje
 * o início/fim do dia é calculado no fuso do NAVEGADOR (`new Date("…T00:00:00")`); calcular aqui,
 * num servidor em UTC, mudaria quais registros entram.
 */
export type FiltrosDePermissao = {
  from_iso: string;
  to_iso: string;
  actor_email?: string;
  action?: string;
  target_table?: string;
  source?: string;
};

/** Texto aparado em `%texto%`; vazio → `null` (sem filtro). */
export function contem(texto: string | undefined): string | null {
  const t = texto?.trim();
  return t ? `%${t}%` : null;
}

export type LinhaDaRpcEcp = Record<string, unknown>;

export interface UnifiedAuditLog {
  id: string;
  source: 'totem' | 'agent' | 'activity';
  entity_id: string;
  entity_name?: string;
  action: string;
  changed_fields: string[];
  previous_values: Record<string, unknown>;
  new_values: Record<string, unknown>;
  performed_by: string;
  created_at: string;
  category?: string;
  summary?: string;
}

/** Linhas da RPC `get_ecp_unified_audit` no formato da tela; o total vem na 1ª linha. */
export function paraAuditoriaUnificada(lista: LinhaDaRpcEcp[]): { rows: UnifiedAuditLog[]; total: number } {
  const total = lista.length > 0 ? Number(lista[0].total_count ?? 0) : 0;
  const rows = lista.map((r) => ({
    id: String(r.id),
    source: r.source as UnifiedAuditLog['source'],
    entity_id: String(r.entity_id),
    entity_name: r.entity_name ? String(r.entity_name) : undefined,
    action: String(r.action),
    changed_fields: (r.changed_fields as string[] | null) ?? [],
    previous_values: (r.previous_values as Record<string, unknown> | null) ?? {},
    new_values: (r.new_values as Record<string, unknown> | null) ?? {},
    performed_by: String(r.performed_by ?? 'admin'),
    created_at: String(r.created_at ?? ''),
    category: r.category ? String(r.category) : undefined,
    summary: r.summary ? String(r.summary) : undefined,
  }));
  return { rows, total };
}
