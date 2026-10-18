"use client";

import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { FileSearch, Download, Eye } from "lucide-react";
import { PageHeader } from "@/shared/layout/page-header";
import { DataTable, type Column } from "@/shared/layout/data-table";
import { TablePagination } from "@/shared/layout/table-pagination";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/shared/ui/dialog";
import {
  contarAuditoriaDePermissoes,
  exportarAuditoriaDePermissoes,
  listarAuditoriaDePermissoes,
} from "@/modules/auditoria/infrastructure/auditoria.api";



type AuditRow = {
  id: string;
  ts: string;
  actor_user_id: string | null;
  actor_email: string | null;
  source: string | null;
  action: string | null;
  target_table: string | null;
  target_id: string | null;
  target_label: string | null;
  before: unknown;
  after: unknown;
  context: unknown;
};

const PAGE_SIZE = 50;
const EXPORT_LIMIT = 10_000;

function isoDaysAgo(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function fmtTs(ts: string) {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

type Filters = {
  from: string;
  to: string;
  actorEmail: string;
  action: string;
  targetTable: string;
  source: string;
};

export function PermissionAuditPage() {
  const [from, setFrom] = useState(isoDaysAgo(7));
  const [to, setTo] = useState(todayISO());
  const [actorEmail, setActorEmail] = useState("");
  const [action, setAction] = useState("");
  const [targetTable, setTargetTable] = useState("");
  const [source, setSource] = useState<string>("all");

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const [exporting, setExporting] = useState(false);
  const [detail, setDetail] = useState<AuditRow | null>(null);

  // Debounce text filters to avoid refetch on every keystroke
  const [dActorEmail, setDActorEmail] = useState(actorEmail);
  const [dAction, setDAction] = useState(action);
  const [dTargetTable, setDTargetTable] = useState(targetTable);
  useEffect(() => {
    const t = setTimeout(() => setDActorEmail(actorEmail), 300);
    return () => clearTimeout(t);
  }, [actorEmail]);
  useEffect(() => {
    const t = setTimeout(() => setDAction(action), 300);
    return () => clearTimeout(t);
  }, [action]);
  useEffect(() => {
    const t = setTimeout(() => setDTargetTable(targetTable), 300);
    return () => clearTimeout(t);
  }, [targetTable]);

  const filters: Filters = {
    from,
    to,
    actorEmail: dActorEmail,
    action: dAction,
    targetTable: dTargetTable,
    source,
  };
  const queryClient = useQueryClient();

  useEffect(() => {
    setPage(1);
  }, [from, to, dActorEmail, dAction, dTargetTable, source, pageSize]);

  const fetchList = (p: number) => listarAuditoriaDePermissoes<AuditRow>(filters, p, pageSize);

  const listKey = (p: number) => ["permission-audit", filters, p, pageSize] as const;

  const listQuery = useQuery({
    queryKey: listKey(page),
    queryFn: () => fetchList(page),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });

  const countQuery = useQuery({
    queryKey: ["permission-audit-count", filters],
    queryFn: () => contarAuditoriaDePermissoes(filters),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });

  const total = countQuery.data ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  // Prefetch next page for instant pagination
  useEffect(() => {
    if (page >= totalPages) return;
    const next = page + 1;
    queryClient.prefetchQuery({
      queryKey: listKey(next),
      queryFn: () => fetchList(next),
      staleTime: 60_000,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, totalPages, pageSize, from, to, dActorEmail, dAction, dTargetTable, source]);

  const handleExport = async () => {
    if (total > EXPORT_LIMIT) {
      toast.error(
        `Mais de ${EXPORT_LIMIT.toLocaleString("pt-BR")} registros. Refine os filtros antes de exportar.`,
      );
      return;
    }
    setExporting(true);
    try {
      const rows = await exportarAuditoriaDePermissoes<AuditRow>(filters);

      const headers = [
        "ts",
        "actor_user_id",
        "actor_email",
        "source",
        "action",
        "target_table",
        "target_id",
        "target_label",
        "context",
      ];
      const esc = (v: unknown) => {
        if (v == null) return "";
        const s = typeof v === "string" ? v : JSON.stringify(v);
        return `"${s.replace(/"/g, '""')}"`;
      };
      const csv = [
        headers.join(","),
        ...rows.map((r) =>
          [
            r.ts,
            r.actor_user_id ?? "",
            r.actor_email ?? "",
            r.source ?? "",
            r.action ?? "",
            r.target_table ?? "",
            r.target_id ?? "",
            r.target_label ?? "",
            r.context ?? "",
          ]
            .map(esc)
            .join(","),
        ),
      ].join("\n");

      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, "0");
      const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `permission-audit-${stamp}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success(`${rows.length} registro(s) exportado(s).`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao exportar CSV.");
    } finally {
      setExporting(false);
    }
  };

  const columns: Column<AuditRow>[] = useMemo(
    () => [
      {
        key: "ts",
        header: "Quando",
        render: (r) => (
          <span className="whitespace-nowrap text-xs text-muted-foreground">
            {fmtTs(r.ts)}
          </span>
        ),
      },
      {
        key: "actor",
        header: "Autor",
        render: (r) => (
          <div className="min-w-0">
            <div className="truncate text-sm">{r.actor_email ?? "—"}</div>
            {r.actor_user_id && (
              <div className="truncate text-[11px] text-muted-foreground">
                {r.actor_user_id.slice(0, 8)}…
              </div>
            )}
          </div>
        ),
      },
      {
        key: "source",
        header: "Origem",
        render: (r) => (
          <span className="inline-flex rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
            {r.source ?? "—"}
          </span>
        ),
      },
      {
        key: "action",
        header: "Ação",
        render: (r) => <span className="font-medium text-sm">{r.action ?? "—"}</span>,
      },
      {
        key: "target",
        header: "Alvo",
        render: (r) => (
          <div className="min-w-0">
            <div className="truncate text-xs">{r.target_label ?? "—"}</div>
            <div className="truncate text-[11px] text-muted-foreground">
              {r.target_table ?? ""}
              {r.target_id ? ` · ${r.target_id.slice(0, 12)}` : ""}
            </div>
          </div>
        ),
      },
      {
        key: "details",
        header: "",
        className: "text-right",
        render: (r) => (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2"
            onClick={() => setDetail(r)}
          >
            <Eye className="mr-1 h-3.5 w-3.5" /> Detalhes
          </Button>
        ),
      },
    ],
    [],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Auditoria de Permissões"
        description="Eventos de pv_permission_audit_log — origem, autor, alvo e payloads (before/after/context)."
        icon={FileSearch}
      />

      <div className="space-y-4 rounded-2xl border border-border bg-card/40 p-5 shadow-[var(--shadow-elegant)] backdrop-blur-sm sm:p-6">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-1.5">
            <Label className="text-xs">De</Label>
            <Input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="h-9"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Até</Label>
            <Input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="h-9"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Origem</Label>
            <Select value={source} onValueChange={setSource}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="trigger">trigger</SelectItem>
                <SelectItem value="edge_function">edge_function</SelectItem>
                <SelectItem value="rpc">rpc</SelectItem>
                <SelectItem value="app">app</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">E-mail do autor</Label>
            <Input
              value={actorEmail}
              onChange={(e) => setActorEmail(e.target.value)}
              placeholder="ex.: ana@empresa.com"
              className="h-9"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Ação contém</Label>
            <Input
              value={action}
              onChange={(e) => setAction(e.target.value)}
              placeholder="ex.: user_role.assign"
              className="h-9"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Tabela alvo contém</Label>
            <Input
              value={targetTable}
              onChange={(e) => setTargetTable(e.target.value)}
              placeholder="ex.: pv_user_role_assignments"
              className="h-9"
            />
          </div>
        </div>

        <div className="flex flex-col items-start justify-between gap-2 sm:flex-row sm:items-center">
          <div className="text-xs text-muted-foreground">
            {countQuery.isLoading ? "Contando…" : `${total.toLocaleString("pt-BR")} evento(s).`}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={exporting || listQuery.isLoading}
          >
            <Download className="mr-1.5 h-3.5 w-3.5" />
            {exporting ? "Exportando…" : "Exportar CSV"}
          </Button>
        </div>

        <DataTable
          rows={listQuery.data}
          columns={columns}
          loading={listQuery.isLoading}
          empty="Nenhum evento no período/filtros."
        />

        <TablePagination
          pageSize={pageSize}
          currentPage={page}
          totalPages={totalPages}
          onPageSizeChange={setPageSize}
          onPageChange={setPage}
        />
      </div>

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Detalhes do evento</DialogTitle>
            <DialogDescription>
              {detail ? `${detail.action ?? "—"} · ${fmtTs(detail.ts)}` : null}
            </DialogDescription>
          </DialogHeader>
          {detail && (
            <div className="grid gap-3 sm:grid-cols-3">
              <PayloadBlock title="before" value={detail.before} />
              <PayloadBlock title="after" value={detail.after} />
              <PayloadBlock title="context" value={detail.context} />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PayloadBlock({ title, value }: { title: string; value: unknown }) {
  return (
    <div className="space-y-1">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </div>
      <pre className="max-h-72 overflow-auto rounded-md border border-border bg-muted/30 p-2 text-[11px] leading-snug">
        {value == null ? "—" : JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}