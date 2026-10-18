import { apiRequest, withQuery } from "@/shared/http/api-client";

/**
 * Listas de empresas e lojas — hoje duas consultas do navegador ao Supabase cada; agora uma
 * chamada à API, que faz as mesmas consultas (até 200 empresas / 300 lojas) e devolve o mesmo formato.
 */
export function listarEmpresas<T>(busca: string): Promise<T[]> {
  return apiRequest<T[]>(withQuery("/companies", { search: busca.trim() || undefined }));
}

export function listarLojas<T>(busca: string, apenasAtivas: boolean): Promise<T[]> {
  return apiRequest<T[]>(withQuery("/stores", { search: busca.trim() || undefined, only_active: apenasAtivas }));
}
