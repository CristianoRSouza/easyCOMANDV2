import { apiRequest, withQuery } from "@/shared/http/api-client";

/**
 * Telas de auditoria — hoje consultas do navegador ao Supabase; agora pela API, com as MESMAS
 * colunas, filtros e paginação.
 */

/** Log de atividade (`activity_logs`), paginado, com busca livre. */
export function listarAtividade<T>(p: { page: number; pageSize: number; search: string }): Promise<{ rows: T[]; total: number }> {
  return apiRequest(withQuery("/audit/activity", { page: p.page, pageSize: p.pageSize, search: p.search.trim() || undefined }));
}

/** Empresas (até 500) para o filtro da auditoria do EasyFoodPay. */
export function listarEmpresasDaAuditoria(): Promise<Array<{ id: string; name: string }>> {
  return apiRequest("/audit/companies");
}

/** Auditoria unificada do EasyFoodPay (RPC `get_ecp_unified_audit`), já no formato da tela. */
export function listarAuditoriaEcp<T>(p: {
  companyId: string;
  source: string;
  action: string;
  user: string;
  /** Início do período, calculado no fuso do navegador (como hoje). */
  from: string | null;
  page: number;
  pageSize: number;
}): Promise<{ rows: T[]; total: number }> {
  return apiRequest(
    withQuery("/audit/easyfoodpay", {
      company_id: p.companyId,
      source: p.source,
      action: p.action,
      user: p.user.trim() || undefined,
      from: p.from ?? undefined,
      page: p.page,
      pageSize: p.pageSize,
    }),
  );
}

/**
 * Filtros da auditoria de permissões. O período vai PRONTO em ISO: o início/fim do dia são
 * calculados no fuso do navegador, exatamente como o `applyFilters` de hoje.
 */
export type FiltrosDePermissao = {
  from: string;
  to: string;
  actorEmail: string;
  action: string;
  targetTable: string;
  source: string;
};

function consultaDosFiltros(f: FiltrosDePermissao) {
  return {
    from_iso: new Date(`${f.from}T00:00:00`).toISOString(),
    to_iso: new Date(`${f.to}T23:59:59.999`).toISOString(),
    actor_email: f.actorEmail.trim() || undefined,
    action: f.action.trim() || undefined,
    target_table: f.targetTable.trim() || undefined,
    source: f.source && f.source !== "all" ? f.source : undefined,
  };
}

export function listarAuditoriaDePermissoes<T>(f: FiltrosDePermissao, page: number, pageSize: number): Promise<T[]> {
  return apiRequest(withQuery("/audit/permissions", { ...consultaDosFiltros(f), page, pageSize }));
}

export async function contarAuditoriaDePermissoes(f: FiltrosDePermissao): Promise<number> {
  return (await apiRequest<{ count: number }>(withQuery("/audit/permissions/count", consultaDosFiltros(f)))).count;
}

export function exportarAuditoriaDePermissoes<T>(f: FiltrosDePermissao): Promise<T[]> {
  return apiRequest(withQuery("/audit/permissions/export", consultaDosFiltros(f)));
}
