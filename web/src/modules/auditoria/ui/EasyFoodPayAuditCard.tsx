"use client";

import { useCallback, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { subDays, startOfDay } from "date-fns";
import {
  PlusCircle,
  Pencil,
  ToggleRight,
  FilterX,
  Monitor,
  Server,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  User,
  Building2,
  Activity,
} from "lucide-react";
import { listarAuditoriaEcp, listarEmpresasDaAuditoria } from "@/modules/auditoria/infrastructure/auditoria.api";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Skeleton } from "@/shared/ui/skeleton";
import { Input } from "@/shared/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";

interface UnifiedAuditLog {
  id: string;
  source: "totem" | "agent" | "activity";
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

const ACTION_CONFIG: Record<
  string,
  { label: string; icon: typeof PlusCircle; variant: "default" | "secondary" | "outline" }
> = {
  created: { label: "Criado", icon: PlusCircle, variant: "default" },
  updated: { label: "Editado", icon: Pencil, variant: "secondary" },
  toggled: { label: "Status alterado", icon: ToggleRight, variant: "outline" },
  page_view: { label: "Navegação", icon: Activity, variant: "outline" },
  login: { label: "Login", icon: User, variant: "secondary" },
  logout: { label: "Logout", icon: User, variant: "outline" },
};

const SOURCE_CONFIG: Record<string, { label: string; icon: typeof Monitor; color: string }> = {
  totem: {
    label: "Totem",
    icon: Monitor,
    color: "bg-blue-500/15 text-blue-600 border-blue-500/30",
  },
  agent: {
    label: "Agente",
    icon: Server,
    color: "bg-amber-500/15 text-amber-600 border-amber-500/30",
  },
  activity: {
    label: "Atividade",
    icon: Activity,
    color: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
  },
};

const FIELD_LABELS: Record<string, string> = {
  totem_name: "Nome",
  is_active: "Ativo",
  nfce_service_url: "URL nfce-service",
  nfce_service_api_key: "API Key NFC-e",
  nfce_emit_timeout_ms: "Timeout emissão NFC-e (ms)",
  tef_http_base_url: "URL base TEF (HTTP)",
  tef_http_api_key: "API Key TEF (X-Api-Key)",
  printer_enabled: "Impressora ativa",
  printer_model: "Modelo impressora",
  printer_port: "Porta impressora",
  printer_code_page: "Code page",
  printer_cols_normal: "Colunas (normal)",
  printer_cut_paper: "Cortar papel",
  printer_cut_type: "Tipo de corte",
  printer_translate_tags: "Traduzir tags",
  printer_ignore_tags: "Ignorar tags",
  printer_verify: "Verificar impressora",
  printer_line_feed_after: "Line feeds após",
  printer_copies: "Cópias",
  printer_timeout_ms: "Timeout impressora (ms)",
  last_heartbeat_at: "Último heartbeat",
  heartbeat_machine_id: "Machine ID",
  agent_name: "Nome do agente",
  api_rate_limit: "Limite de API",
  log_level: "Nível de log",
  sefaz_timeout_ms: "Timeout SEFAZ (ms)",
  retry_max_attempts: "Tentativas de retry",
  retry_backoff_ms: "Backoff de retry (ms)",
  contingency_enabled: "Contingência habilitada",
  contingency_reason: "Motivo de contingência",
  sync_service_enabled: "Sincronização habilitada",
  sync_service_url: "URL de sincronização",
};

type PeriodFilter = "all" | "today" | "7d" | "30d";
type SourceFilter = "all" | "totem" | "agent" | "activity";

const PAGE_SIZE_OPTIONS = [10, 25, 50] as const;

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "Sim" : "Não";
  return String(value);
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString("pt-BR")} ${d.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })}`;
}

interface FetchParams {
  companyId: string;
  source: SourceFilter;
  action: string;
  user: string;
  period: PeriodFilter;
  page: number;
  pageSize: number;
}

function periodCutoff(period: PeriodFilter): string | null {
  if (period === "all") return null;
  const daysMap: Record<Exclude<PeriodFilter, "all">, number> = {
    today: 0,
    "7d": 7,
    "30d": 30,
  };
  return startOfDay(subDays(new Date(), daysMap[period])).toISOString();
}

async function fetchUnifiedAuditPage(
  params: FetchParams,
): Promise<{ rows: UnifiedAuditLog[]; total: number }> {
  return listarAuditoriaEcp<UnifiedAuditLog>({
    companyId: params.companyId,
    source: params.source,
    action: params.action,
    user: params.user,
    from: periodCutoff(params.period),
    page: params.page,
    pageSize: params.pageSize,
  });
}

export function EasyFoodPayAuditCard() {
  const [companyId, setCompanyId] = useState<string>("");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>("30d");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [userFilter, setUserFilter] = useState<string>("");
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  const { data: companies = [] } = useQuery({
    queryKey: ["audit-ecp-companies"],
    queryFn: listarEmpresasDaAuditoria,
  });

  const {
    data,
    isLoading,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: [
      "ecp-unified-audit-logs",
      companyId,
      sourceFilter,
      actionFilter,
      periodFilter,
      userFilter.trim(),
      pageSize,
      currentPage,
    ],
    queryFn: () =>
      fetchUnifiedAuditPage({
        companyId,
        source: sourceFilter,
        action: actionFilter,
        user: userFilter,
        period: periodFilter,
        page: currentPage,
        pageSize,
      }),
    enabled: !!companyId,
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  });

  const visibleLogs = data?.rows ?? [];
  const totalCount = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const safePage = Math.min(currentPage, totalPages);

  const resetPage = useCallback(() => setCurrentPage(1), []);
  const hasFilters =
    actionFilter !== "all" ||
    periodFilter !== "30d" ||
    sourceFilter !== "all" ||
    userFilter.trim().length > 0;

  const clearFilters = () => {
    setActionFilter("all");
    setPeriodFilter("30d");
    setSourceFilter("all");
    setUserFilter("");
    resetPage();
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Toolbar */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Building2 className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Select
            value={companyId}
            onValueChange={(v) => {
              setCompanyId(v);
              resetPage();
            }}
          >
            <SelectTrigger className="h-9 pl-8 text-xs">
              <SelectValue placeholder="Selecione uma empresa" />
            </SelectTrigger>
            <SelectContent>
              {companies.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => refetch()}
          disabled={!companyId || isFetching}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-2 rounded-md border border-border bg-muted/20 p-2.5 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="grid grid-cols-3 gap-2 sm:flex sm:items-center sm:flex-wrap">
          <Select
            value={sourceFilter}
            onValueChange={(v) => {
              setSourceFilter(v as SourceFilter);
              resetPage();
            }}
          >
            <SelectTrigger className="h-9 text-xs sm:h-8 sm:w-[140px]">
              <SelectValue placeholder="Origem" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as origens</SelectItem>
              <SelectItem value="totem">Totens</SelectItem>
              <SelectItem value="agent">Agentes</SelectItem>
              <SelectItem value="activity">Atividades</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={actionFilter}
            onValueChange={(v) => {
              setActionFilter(v);
              resetPage();
            }}
          >
            <SelectTrigger className="h-9 text-xs sm:h-8 sm:w-[160px]">
              <SelectValue placeholder="Tipo de ação" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as ações</SelectItem>
              <SelectItem value="created">Criado</SelectItem>
              <SelectItem value="updated">Editado</SelectItem>
              <SelectItem value="toggled">Status alterado</SelectItem>
              <SelectItem value="page_view">Navegação</SelectItem>
              <SelectItem value="login">Login</SelectItem>
              <SelectItem value="logout">Logout</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={periodFilter}
            onValueChange={(v) => {
              setPeriodFilter(v as PeriodFilter);
              resetPage();
            }}
          >
            <SelectTrigger className="h-9 text-xs sm:h-8 sm:w-[140px]">
              <SelectValue placeholder="Período" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todo período</SelectItem>
              <SelectItem value="today">Hoje</SelectItem>
              <SelectItem value="7d">Últimos 7 dias</SelectItem>
              <SelectItem value="30d">Últimos 30 dias</SelectItem>
            </SelectContent>
          </Select>
          <div className="col-span-3 sm:col-auto relative">
            <User className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Filtrar por usuário"
              value={userFilter}
              onChange={(e) => {
                setUserFilter(e.target.value);
                resetPage();
              }}
              className="h-9 pl-8 text-xs sm:h-8 sm:w-[220px]"
            />
          </div>
        </div>
        <div className="flex items-center justify-between gap-2 sm:contents">
          {hasFilters && (
            <Button variant="ghost" size="sm" className="h-8 text-xs gap-1" onClick={clearFilters}>
              <FilterX className="h-3.5 w-3.5" /> Limpar
            </Button>
          )}
          <div className="flex items-center gap-1.5 sm:ml-auto">
            <span className="text-[11px] text-muted-foreground sm:text-xs">Exibir</span>
            <Select
              value={String(pageSize)}
              onValueChange={(v) => {
                setPageSize(Number(v));
                resetPage();
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
            <span className="text-[11px] text-muted-foreground sm:text-xs">
              — {totalCount} registro(s){isFetching ? " · atualizando…" : ""}
            </span>
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="min-h-[120px]">
        {!companyId ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Selecione uma empresa para visualizar o histórico de auditoria.
          </p>
        ) : isLoading ? (
          <div className="space-y-4 py-2" aria-busy="true">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-5 w-20 rounded-full" />
                  <Skeleton className="h-3 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="h-16 w-full rounded-md" />
              </div>
            ))}
          </div>
        ) : visibleLogs.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {hasFilters
              ? "Nenhum registro para os filtros selecionados"
              : "Nenhum registro de auditoria"}
          </p>
        ) : (
          <div className="relative space-y-0 pl-5 sm:pl-6">
            <div className="absolute left-[9px] sm:left-[11px] top-2 bottom-2 w-px bg-border" />
            {visibleLogs.map((log) => {
              const config = ACTION_CONFIG[log.action] ?? ACTION_CONFIG.updated;
              const srcConfig = SOURCE_CONFIG[log.source];
              const Icon = config.icon;
              const SrcIcon = srcConfig.icon;
              return (
                <div key={log.id} className="relative pb-5 sm:pb-6 last:pb-0">
                  <div className="absolute -left-5 sm:-left-6 top-1 flex h-[20px] w-[20px] items-center justify-center rounded-full border-2 border-border bg-background sm:h-[22px] sm:w-[22px]">
                    <Icon className="h-3 w-3 text-muted-foreground" />
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-1.5 gap-y-1">
                      <Badge className={`text-[10px] border ${srcConfig.color}`}>
                        <SrcIcon className="mr-1 h-3 w-3" />
                        {srcConfig.label}
                      </Badge>
                      <Badge variant={config.variant} className="text-[10px]">
                        {config.label}
                      </Badge>
                      {log.entity_name && (
                        <span className="text-[11px] font-medium text-foreground sm:text-xs">
                          {log.entity_name}
                        </span>
                      )}
                      <span className="text-[11px] text-muted-foreground sm:text-xs">
                        {formatDateTime(log.created_at)}
                      </span>
                      <span className="break-all text-[11px] text-muted-foreground sm:text-xs">
                        por <span className="font-medium text-foreground">{log.performed_by}</span>
                      </span>
                    </div>
                    {log.changed_fields.length > 0 && (
                      <div className="space-y-2 rounded-md bg-muted/50 p-2.5 text-xs sm:p-3">
                        {log.changed_fields.map((field) => {
                          const label = FIELD_LABELS[field] ?? field;
                          const prev = log.previous_values[field];
                          const next = log.new_values[field];
                          return (
                            <div
                              key={field}
                              className="flex flex-col gap-0.5 sm:flex-row sm:items-start sm:gap-1.5"
                            >
                              <span className="shrink-0 font-medium text-muted-foreground sm:min-w-[160px]">
                                {label}:
                              </span>
                              {log.action === "created" ? (
                                <span className="break-all text-foreground">
                                  {formatValue(next)}
                                </span>
                              ) : (
                                <span className="break-all">
                                  <span className="text-destructive line-through">
                                    {formatValue(prev)}
                                  </span>
                                  <span className="mx-1 text-muted-foreground">→</span>
                                  <span className="font-medium text-primary">
                                    {formatValue(next)}
                                  </span>
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {log.source === "activity" && (log.summary || Object.keys(log.new_values).length > 0) && (
                      <div className="space-y-1 rounded-md bg-muted/50 p-2.5 text-xs sm:p-3">
                        {log.summary && (
                          <div className="text-foreground">{log.summary}</div>
                        )}
                        {Object.keys(log.new_values).length > 0 && (
                          <pre className="whitespace-pre-wrap break-all text-[11px] text-muted-foreground">
                            {JSON.stringify(log.new_values, null, 2)}
                          </pre>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalCount > 0 && totalPages > 1 && (
        <div className="flex items-center justify-between gap-2 pt-1">
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
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((p) => p === 1 || p === totalPages || Math.abs(p - safePage) <= 1)
              .reduce<(number | "ellipsis")[]>((acc, p, idx, arr) => {
                if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push("ellipsis");
                acc.push(p);
                return acc;
              }, [])
              .map((item, idx) =>
                item === "ellipsis" ? (
                  <span key={`e${idx}`} className="px-1 text-xs text-muted-foreground">
                    …
                  </span>
                ) : (
                  <Button
                    key={item}
                    variant={item === safePage ? "default" : "outline"}
                    size="icon"
                    className="h-8 w-8 text-xs"
                    onClick={() => setCurrentPage(item)}
                  >
                    {item}
                  </Button>
                ),
              )}
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
  );
}