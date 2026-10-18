"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "@/shared/layout/page-header";
import { DataTable, type Column } from "@/shared/layout/data-table";
import { CollapsibleCard } from "@/shared/layout/collapsible-card";
import { listarAtividade } from "@/modules/auditoria/infrastructure/auditoria.api";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";
import { EasyFoodPayAuditCard } from "@/modules/auditoria/ui/EasyFoodPayAuditCard";
import { Button } from "@/shared/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";



interface LogRow {
  id: string; created_at: string; user_email: string | null;
  category: string | null; action: string | null;
  entity_type: string | null; entity_id: string | null;
  summary: string | null; company_id: string | null;
}

const PAGE_SIZE_OPTIONS = [10, 25, 50] as const;

export function AuditPage() {
  const [search, setSearch] = useState("");
  const [pageSize, setPageSize] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState(1);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["audit", search, pageSize, currentPage],
    queryFn: () => listarAtividade<LogRow>({ page: currentPage, pageSize, search }),
    placeholderData: (prev) => prev,
  });

  const rows = data?.rows ?? [];
  const totalCount = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const safePage = Math.min(currentPage, totalPages);

  const columns: Column<LogRow>[] = [
    { key: "when", header: "Quando", render: (r) => (
      <span className="whitespace-nowrap text-xs text-muted-foreground">
        {new Date(r.created_at).toLocaleString("pt-BR")}
      </span>
    )},
    { key: "who", header: "Autor", render: (r) => <span className="text-xs">{r.user_email ?? "—"}</span> },
    { key: "cat", header: "Categoria", render: (r) => (
      <span className="inline-flex rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
        {r.category ?? "—"}
      </span>
    )},
    { key: "action", header: "Ação", render: (r) => <span className="font-medium">{r.action ?? "—"}</span> },
    { key: "entity", header: "Entidade", render: (r) => (
      <span className="text-xs text-muted-foreground">
        {r.entity_type ?? "—"}{r.entity_id ? ` · ${r.entity_id.slice(0, 8)}` : ""}
      </span>
    )},
    { key: "summary", header: "Resumo", render: (r) => (
      <span className="text-xs text-muted-foreground">{r.summary ?? "—"}</span>
    )},
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Auditoria Global"
        description="Eventos da tabela activity_logs — quem, quando, o quê."
      />
      <CollapsibleCard
        title="Filtros & Busca"
        description="Busque por ação, autor, categoria ou entidade."
        defaultOpen={false}
      >
        <div className="relative max-w-md">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Buscar ação, autor, entidade…"
            className="w-full rounded-md border border-input bg-input py-1.5 pl-8 pr-3 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30" />
        </div>
      </CollapsibleCard>
      <CollapsibleCard
        title="Global"
        description="Eventos da tabela activity_logs — comuns a todos os módulos."
        defaultOpen={false}
      >
        <CollapsibleCard
          title="Eventos"
          description={`${totalCount} evento(s)${isFetching ? " · atualizando…" : ""}.`}
          defaultOpen={false}
        >
          <div className="space-y-3">
          <DataTable rows={rows} columns={columns} loading={isLoading} />
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-muted-foreground sm:text-xs">Exibir</span>
              <Select
                value={String(pageSize)}
                onValueChange={(v) => {
                  setPageSize(Number(v));
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="h-7 w-[62px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAGE_SIZE_OPTIONS.map((s) => (
                    <SelectItem key={s} value={String(s)}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-[11px] text-muted-foreground sm:text-xs">por página</span>
            </div>
            {totalPages > 1 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  Página {safePage} de {totalPages}
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    disabled={safePage <= 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    disabled={safePage >= totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </CollapsibleCard>
      </CollapsibleCard>
      <CollapsibleCard
        title="EasyFoodPay"
        description="Histórico de alterações em Totens e Agentes de Serviço (por empresa)."
        defaultOpen={false}
      >
        <EasyFoodPayAuditCard />
      </CollapsibleCard>
    </div>
  );
}
