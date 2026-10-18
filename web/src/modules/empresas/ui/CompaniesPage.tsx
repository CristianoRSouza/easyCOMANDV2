"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/shared/layout/page-header";
import { DataTable, type Column } from "@/shared/layout/data-table";
import { TablePagination } from "@/shared/layout/table-pagination";
import { listarEmpresas } from "@/modules/empresas/infrastructure/empresas.api";
import { Search, Building2 } from "lucide-react";



interface Company {
  id: string;
  name: string;
  cnpj: string | null;
  document: string | null;
  email: string | null;
  city: string | null;
  state: string | null;
  created_at: string;
  store_count?: number;
}

export function CompaniesPage() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const { data, isLoading } = useQuery({
    queryKey: ["companies", debouncedSearch],
    queryFn: () => listarEmpresas<Company>(debouncedSearch),
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    placeholderData: keepPreviousData,
  });

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, pageSize]);

  const total = data?.length ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const pageRows = useMemo(
    () => (data ?? []).slice((safePage - 1) * pageSize, safePage * pageSize),
    [data, safePage, pageSize],
  );

  const columns: Column<Company>[] = [
    { key: "name", header: "Empresa", render: (r) => <span className="font-medium">{r.name}</span> },
    { key: "cnpj", header: "CNPJ", render: (r) => <span className="font-mono text-xs text-muted-foreground">{r.cnpj ?? r.document ?? "—"}</span> },
    { key: "location", header: "UF / Cidade", render: (r) => <span className="text-muted-foreground">{[r.city, r.state].filter(Boolean).join(" / ") || "—"}</span> },
    { key: "email", header: "E-mail", render: (r) => <span className="text-muted-foreground">{r.email ?? "—"}</span> },
    { key: "stores", header: "Lojas", render: (r) => <span className="inline-flex items-center rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">{r.store_count}</span> },
    { key: "created", header: "Criada em", render: (r) => <span className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString("pt-BR")}</span> },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Empresas (Tenants)"
        description="Listagem de todas as empresas multitenant do ecossistema."
        icon={Building2}
      />
      <div className="space-y-4 rounded-2xl border border-border bg-card/40 p-5 shadow-[var(--shadow-elegant)] backdrop-blur-sm sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-base font-semibold tracking-tight">Lista de Empresas</h2>
            <p className="text-xs text-muted-foreground">
              {total} empresa(s) — limite de 200 por consulta.
            </p>
          </div>
          <div className="relative w-full sm:w-80">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome, CNPJ ou e-mail"
              className="w-full rounded-md border border-input bg-input py-1.5 pl-8 pr-3 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
            />
          </div>
        </div>
        <DataTable rows={pageRows} columns={columns} loading={isLoading} />
        <TablePagination
          pageSize={pageSize}
          currentPage={safePage}
          totalPages={totalPages}
          onPageSizeChange={setPageSize}
          onPageChange={setCurrentPage}
        />
      </div>
    </div>
  );
}
