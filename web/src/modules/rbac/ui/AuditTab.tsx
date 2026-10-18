"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@/shared/http/server-fn";
import { manageRbac } from "@/modules/rbac/infrastructure/rbac.functions";
import type { RbacAuditEntry } from "@/modules/rbac/domain/types";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Badge } from "@/shared/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/shared/ui/select";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/shared/ui/popover";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/shared/ui/command";
import { DataTable, type Column } from "@/shared/layout/data-table";
import { useToast } from "@/shared/hooks/use-toast";
import { Search, X, ChevronLeft, ChevronRight, User, FileJson } from "lucide-react";
import { cn } from "@/shared/lib/utils";

const ENTITY_OPTIONS = [
  { value: "__all", label: "Todas" },
  { value: "module", label: "Módulo" },
  { value: "permission", label: "Permissão" },
  { value: "role", label: "Role" },
  { value: "user_role_assignment", label: "Atribuição de Role" },
  { value: "user_permission", label: "Override de Permissão" },
];

const ACTION_LABELS: Record<string, string> = {
  create: "Criar",
  update: "Atualizar",
  delete: "Excluir",
  duplicate: "Duplicar",
  assign_role: "Atribuir Role",
  revoke_assignment: "Revogar Atribuição",
  set_override: "Definir Override",
  delete_override: "Remover Override",
};

const ACTION_TONE: Record<string, string> = {
  create: "bg-emerald-500/15 text-emerald-600",
  update: "bg-primary/15 text-primary",
  delete: "bg-destructive/15 text-destructive",
  duplicate: "bg-secondary text-secondary-foreground",
  assign_role: "bg-primary/15 text-primary",
  revoke_assignment: "bg-warning/15 text-warning",
  set_override: "bg-primary/15 text-primary",
  delete_override: "bg-destructive/15 text-destructive",
};

interface AuditResult {
  rows: RbacAuditEntry[];
  total: number;
}

export function AuditTab() {
  const rbac = useServerFn(manageRbac);
  const { toast } = useToast();

  const [page, setPage] = useState(0);
  const [limit, setLimit] = useState(25);
  const [entityFilter, setEntityFilter] = useState<string>("__all");
  const [actorSearch, setActorSearch] = useState("");
  const [actorOpen, setActorOpen] = useState(false);
  const [selectedActorId, setSelectedActorId] = useState<string | null>(null);
  const [selectedActorLabel, setSelectedActorLabel] = useState<string | null>(null);

  const entityParam = entityFilter === "__all" ? undefined : entityFilter;
  const actorParam = selectedActorId ?? undefined;

  const offset = page * limit;

  const { data, isLoading } = useQuery({
    queryKey: ["rbac", "audit", limit, offset, entityParam, actorParam],
    queryFn: () =>
      rbac({
        data: {
          action: "list_audit",
          limit,
          offset,
          entity: entityParam,
          actor_id: actorParam,
        } as never,
      }) as Promise<AuditResult>,
  });

  const { data: users } = useQuery({
    queryKey: ["rbac", "search_users", actorSearch.trim()],
    queryFn: () =>
      rbac({
        data: { action: "search_users", query: actorSearch.trim() } as never,
      }) as Promise<{ id: string; email: string | null; full_name: string | null }[]>,
    enabled: actorSearch.trim().length >= 2,
  });

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  const handleActorSelect = (user: { id: string; email: string | null; full_name: string | null }) => {
    setSelectedActorId(user.id);
    setSelectedActorLabel(user.full_name ?? user.email ?? user.id);
    setActorOpen(false);
    setPage(0);
  };

  const clearActor = () => {
    setSelectedActorId(null);
    setSelectedActorLabel(null);
    setActorSearch("");
    setPage(0);
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const columns: Column<RbacAuditEntry>[] = useMemo(
    () => [
      {
        key: "created_at",
        header: "Data/Hora",
        className: "whitespace-nowrap",
        render: (r) => <span className="text-xs tabular-nums">{formatDate(r.created_at)}</span>,
      },
      {
        key: "action",
        header: "Ação",
        className: "whitespace-nowrap",
        render: (r) => (
          <span className={cn("inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium", ACTION_TONE[r.action] ?? "bg-muted text-muted-foreground")}>
            {ACTION_LABELS[r.action] ?? r.action}
          </span>
        ),
      },
      {
        key: "entity",
        header: "Entidade",
        render: (r) => (
          <div className="flex items-center gap-1.5">
            <Badge variant="outline" className="text-[11px] font-mono">{r.entity}</Badge>
            {r.entity_id && (
              <span className="text-[11px] font-mono text-muted-foreground truncate max-w-[120px]">{r.entity_id}</span>
            )}
          </div>
        ),
      },
      {
        key: "actor",
        header: "Ator",
        render: (r) => (
          <div className="flex items-center gap-1.5">
            <User className="h-3 w-3 text-muted-foreground" />
            <span className="text-xs">
              {r.actor?.full_name ?? r.actor?.email ?? r.actor_id ?? "—"}
            </span>
          </div>
        ),
      },
      {
        key: "payload",
        header: "Payload",
        className: "max-w-[260px]",
        render: (r) => {
          const text = JSON.stringify(r.payload ?? {});
          if (text.length <= 60) {
            return (
              <span className="text-[11px] font-mono text-muted-foreground">{text}</span>
            );
          }
          return (
            <div className="flex items-center gap-1">
              <FileJson className="h-3 w-3 text-muted-foreground shrink-0" />
              <span className="text-[11px] font-mono text-muted-foreground truncate">{text.slice(0, 60)}…</span>
            </div>
          );
        },
      },
    ],
    [],
  );

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label className="text-[11px] uppercase text-muted-foreground">Entidade</Label>
          <Select value={entityFilter} onValueChange={(v) => { setEntityFilter(v); setPage(0); }}>
            <SelectTrigger className="w-48 h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ENTITY_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label className="text-[11px] uppercase text-muted-foreground">Ator</Label>
          {selectedActorId ? (
            <div className="flex items-center gap-2 h-8 px-3 rounded-md border border-border bg-card text-sm">
              <User className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs">{selectedActorLabel}</span>
              <Button size="icon" variant="ghost" className="h-5 w-5 ml-1" onClick={clearActor}>
                <X className="h-3 w-3" />
              </Button>
            </div>
          ) : (
            <Popover open={actorOpen} onOpenChange={setActorOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 gap-1">
                  <Search className="h-3.5 w-3.5" />
                  <span className="text-xs">Buscar ator…</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-72 p-0" align="start">
                <Command>
                  <CommandInput
                    placeholder="Nome ou email…"
                    value={actorSearch}
                    onValueChange={setActorSearch}
                  />
                  <CommandList>
                    <CommandEmpty>
                      {actorSearch.trim().length < 2
                        ? "Digite ao menos 2 caracteres"
                        : "Nenhum usuário encontrado"}
                    </CommandEmpty>
                    <CommandGroup>
                      {(users ?? []).map((u) => (
                        <CommandItem
                          key={u.id}
                          onSelect={() => handleActorSelect(u)}
                          className="cursor-pointer"
                        >
                          <div className="flex flex-col">
                            <span className="text-xs font-medium">{u.full_name ?? u.email ?? u.id}</span>
                            {u.full_name && u.email && (
                              <span className="text-[11px] text-muted-foreground">{u.email}</span>
                            )}
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          )}
        </div>

        <div className="space-y-1">
          <Label className="text-[11px] uppercase text-muted-foreground">Por página</Label>
          <Select value={String(limit)} onValueChange={(v) => { setLimit(Number(v)); setPage(0); }}>
            <SelectTrigger className="w-24 h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10</SelectItem>
              <SelectItem value="25">25</SelectItem>
              <SelectItem value="50">50</SelectItem>
              <SelectItem value="100">100</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Stats */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {total} registro(s) · Página {page + 1} de {totalPages}
        </p>
      </div>

      {/* Table */}
      <DataTable rows={rows} columns={columns} loading={isLoading} />

      {/* Pagination */}
      <div className="flex items-center justify-end gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={page === 0 || isLoading}
          onClick={() => setPage((p) => Math.max(0, p - 1))}
        >
          <ChevronLeft className="h-3.5 w-3.5 mr-1" />Anterior
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={page >= totalPages - 1 || isLoading}
          onClick={() => setPage((p) => p + 1)}
        >
          Próximo<ChevronRight className="h-3.5 w-3.5 ml-1" />
        </Button>
      </div>
    </div>
  );
}
