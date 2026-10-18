"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/shared/layout/page-header";
import { DataTable, type Column } from "@/shared/layout/data-table";
import { TablePagination } from "@/shared/layout/table-pagination";
import { listarLojas } from "@/modules/empresas/infrastructure/empresas.api";
import { Search, Store } from "lucide-react";



interface StoreRow {
  id: string;
  trade_name: string | null;
  legal_name: string | null;
  cnpj: string | null;
  is_active: boolean;
  email: string | null;
  phone1: string | null;
  company_id: string;
  company_name?: string | null;
  created_at: string;
}

export function StoresPage() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [onlyActive, setOnlyActive] = useState(true);
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const { data, isLoading } = useQuery({
    queryKey: ["stores", debouncedSearch, onlyActive],
    queryFn: () => listarLojas<StoreRow>(debouncedSearch, onlyActive),
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    placeholderData: keepPreviousData,
  });

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, onlyActive, pageSize]);

  const total = data?.length ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const pageRows = useMemo(
    () => (data ?? []).slice((safePage - 1) * pageSize, safePage * pageSize),
    [data, safePage, pageSize],
  );

  const columns: Column<StoreRow>[] = [
    { key: "name", header: "Loja", render: (r) => (
      <div>
        <div className="font-medium">{r.trade_name ?? r.legal_name ?? "—"}</div>
        {r.legal_name && r.trade_name !== r.legal_name && (
          <div className="text-[11px] text-muted-foreground">{r.legal_name}</div>
        )}
      </div>
    )},
    { key: "company", header: "Empresa", render: (r) => <span className="text-muted-foreground">{r.company_name ?? "—"}</span> },
    { key: "cnpj", header: "CNPJ", render: (r) => <span className="font-mono text-xs text-muted-foreground">{r.cnpj ?? "—"}</span> },
    { key: "contact", header: "Contato", render: (r) => (
      <div className="text-xs text-muted-foreground">
        {r.email && <div>{r.email}</div>}
        {r.phone1 && <div>{r.phone1}</div>}
        {!r.email && !r.phone1 && "—"}
      </div>
    )},
    { key: "status", header: "Status", render: (r) => (
      <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${
        r.is_active ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"
      }`}>
        {r.is_active ? "Ativa" : "Inativa"}
      </span>
    )},
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Lojas"
        description="Lojas vinculadas às empresas multitenant."
        icon={Store}
      />
      <div className="space-y-4 rounded-2xl border border-border bg-card/40 p-5 shadow-[var(--shadow-elegant)] backdrop-blur-sm sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-base font-semibold tracking-tight">Lista de Lojas</h2>
            <p className="text-xs text-muted-foreground">{total} loja(s) — limite de 300.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={onlyActive}
                onChange={(e) => setOnlyActive(e.target.checked)}
                className="rounded border-input"
              />
              Somente ativas
            </label>
            <div className="relative w-full sm:w-72">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar loja ou CNPJ"
                className="w-full rounded-md border border-input bg-input py-1.5 pl-8 pr-3 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
              />
            </div>
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
