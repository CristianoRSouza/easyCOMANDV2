/** Regras puras das telas "Empresas" e "Lojas" (`routes/_admin.companies.tsx`, `_admin.stores.tsx`). */

export type EmpresaLinha = {
  id: string;
  name: string;
  cnpj: string | null;
  document: string | null;
  email: string | null;
  city: string | null;
  state: string | null;
  created_at: string;
};

export type Empresa = EmpresaLinha & { store_count: number };

export type LojaLinha = {
  id: string;
  trade_name: string | null;
  legal_name: string | null;
  cnpj: string | null;
  is_active: boolean | null;
  email: string | null;
  phone1: string | null;
  company_id: string;
  created_at: string;
};

export type Loja = LojaLinha & { company_name: string | null };

/** Termo aparado em `%termo%`; vazio → `null`. */
const like = (termo: string | undefined) => {
  const t = termo?.trim();
  return t ? `%${t}%` : null;
};

export function filtroDeEmpresas(termo: string | undefined): string | null {
  const t = like(termo);
  return t ? `name.ilike.${t},cnpj.ilike.${t},email.ilike.${t}` : null;
}

export function filtroDeLojas(termo: string | undefined): string | null {
  const t = like(termo);
  return t ? `trade_name.ilike.${t},legal_name.ilike.${t},cnpj.ilike.${t}` : null;
}

export function comContagemDeLojas(empresas: EmpresaLinha[], lojasPorEmpresa: string[]): Empresa[] {
  const contagem = new Map<string, number>();
  for (const id of lojasPorEmpresa) contagem.set(id, (contagem.get(id) ?? 0) + 1);
  return empresas.map((c) => ({ ...c, store_count: contagem.get(c.id) ?? 0 }));
}

export function comNomeDaEmpresa(lojas: LojaLinha[], nomes: Array<{ id: string; name: string }>): Loja[] {
  const porId = new Map(nomes.map((c) => [c.id, c.name]));
  return lojas.map((s) => ({ ...s, company_name: porId.get(s.company_id) ?? null }));
}
