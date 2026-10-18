"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@/shared/http/server-fn";
import { manageRbac } from "@/modules/rbac/infrastructure/rbac.functions";
import {
  rbacAssignmentsQO,
  rbacCompaniesQO,
  rbacRolesQO,
} from "@/modules/rbac/infrastructure/query-options";
import type {
  OverrideEffect,
  RbacAssignment,
  RbacOverride,
  RbacPermission,
  RbacRole,
  RbacScope,
} from "@/modules/rbac/domain/types";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Badge } from "@/shared/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/shared/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/shared/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/shared/ui/alert-dialog";
import { DataTable, type Column } from "@/shared/layout/data-table";
import { useToast } from "@/shared/hooks/use-toast";
import {
  Plus, Trash2, Search, UserCog, ShieldOff, ShieldCheck, Settings2,
} from "lucide-react";

type Profile = { id: string; email: string | null; full_name: string | null };
type Company = { id: string; name: string };
type Store = { id: string; trade_name: string | null; company_id: string };

const scopeTone: Record<RbacScope, string> = {
  global: "bg-primary/15 text-primary",
  company: "bg-warning/15 text-warning",
  store: "bg-muted text-muted-foreground",
};

export function AssignmentsTab() {
  const qc = useQueryClient();
  const rbac = useServerFn(manageRbac);
  const { toast } = useToast();

  const [search, setSearch] = useState("");
  const [companyFilter, setCompanyFilter] = useState<string>("__all");
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);

  const { data: companies } = useQuery(rbacCompaniesQO());
  const { data: users, isLoading: loadingUsers } = useQuery({
    queryKey: ["rbac", "users", search],
    queryFn: () =>
      rbac({ data: { action: "search_users", query: search } as never }) as Promise<Profile[]>,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
  const { data: assignments, isLoading: loadingAssignments } = useQuery(
    rbacAssignmentsQO(companyFilter),
  );

  const grouped = useMemo(() => {
    const map = new Map<string, { user: RbacAssignment["user"]; rows: RbacAssignment[] }>();
    for (const a of assignments ?? []) {
      const e = map.get(a.user_id) ?? { user: a.user, rows: [] as RbacAssignment[] };
      e.rows.push(a);
      map.set(a.user_id, e);
    }
    return Array.from(map.values()).sort((a, b) =>
      (a.user.full_name ?? a.user.email ?? "").localeCompare(b.user.full_name ?? b.user.email ?? ""),
    );
  }, [assignments]);

  const visibleUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (users ?? []).filter((u) => {
      if (!q) return true;
      return (
        (u.email ?? "").toLowerCase().includes(q) ||
        (u.full_name ?? "").toLowerCase().includes(q)
      );
    });
  }, [users, search]);

  const [assignOpen, setAssignOpen] = useState(false);
  const [overridesOpen, setOverridesOpen] = useState(false);
  const [toRevoke, setToRevoke] = useState<RbacAssignment | null>(null);

  const revoke = useMutation({
    mutationFn: (id: string) =>
      rbac({ data: { action: "revoke_assignment", assignment_id: id } as never }),
    onSuccess: (_d, id) => {
      qc.setQueriesData<RbacAssignment[]>({ queryKey: ["rbac", "assignments"] }, (prev) =>
        prev ? prev.filter((a) => a.id !== id) : prev,
      );
      toast({ title: "Atribuição removida" });
      setToRevoke(null);
    },
    onError: (e: Error) =>
      toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[280px,1fr] gap-4">
      {/* Sidebar: search users */}
      <aside className="rounded-lg border border-border bg-card">
        <div className="p-3 border-b border-border space-y-2">
          <Label className="text-[11px] uppercase text-muted-foreground">Usuários</Label>
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome ou email"
              className="pl-7 h-8"
            />
          </div>
        </div>
        <div className="max-h-[60vh] overflow-y-auto divide-y divide-border">
          {loadingUsers && <div className="p-3 text-xs text-muted-foreground">Carregando…</div>}
          {!loadingUsers && visibleUsers.length === 0 && (
            <div className="p-3 text-xs text-muted-foreground">Nenhum usuário encontrado.</div>
          )}
          {visibleUsers.map((u) => {
            const active = selectedUser?.id === u.id;
            const assignCount = (assignments ?? []).filter((a) => a.user_id === u.id).length;
            return (
              <button
                key={u.id}
                onClick={() => setSelectedUser(u)}
                className={`w-full text-left px-3 py-2 hover:bg-muted/40 ${active ? "bg-muted/60" : ""}`}
              >
                <div className="text-sm font-medium text-foreground truncate">
                  {u.full_name ?? "(sem nome)"}
                </div>
                <div className="text-[11px] text-muted-foreground truncate">{u.email ?? "—"}</div>
                {assignCount > 0 && (
                  <Badge variant="secondary" className="mt-1 text-[10px]">
                    {assignCount} role{assignCount === 1 ? "" : "s"}
                  </Badge>
                )}
              </button>
            );
          })}
        </div>
      </aside>

      {/* Main area */}
      <section className="space-y-4 min-w-0">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="space-y-1">
            <Label className="text-[11px] uppercase text-muted-foreground">Empresa</Label>
            <Select value={companyFilter} onValueChange={setCompanyFilter}>
              <SelectTrigger className="w-60 h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all">Todas</SelectItem>
                {(companies ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={!selectedUser}
              onClick={() => setOverridesOpen(true)}
            >
              <Settings2 className="h-3.5 w-3.5 mr-1" />Overrides
            </Button>
            <Button
              size="sm"
              disabled={!selectedUser}
              onClick={() => setAssignOpen(true)}
            >
              <Plus className="h-3.5 w-3.5 mr-1" />Atribuir role
            </Button>
          </div>
        </div>

        {selectedUser ? (
          <UserAssignments
            user={selectedUser}
            rows={(grouped.find((g) => g.user.id === selectedUser.id)?.rows ?? [])}
            loading={loadingAssignments}
            onRevoke={(a) => setToRevoke(a)}
          />
        ) : (
          <AllAssignments grouped={grouped} loading={loadingAssignments} onRevoke={(a) => setToRevoke(a)} />
        )}

        {selectedUser && (
          <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
            {assignOpen && (
              <AssignRoleDialog
                user={selectedUser}
                companies={companies ?? []}
                onDone={() => {
                  setAssignOpen(false);
                  qc.invalidateQueries({ queryKey: ["rbac", "assignments"] });
                }}
              />
            )}
          </Dialog>
        )}

        {selectedUser && (
          <Dialog open={overridesOpen} onOpenChange={setOverridesOpen}>
            {overridesOpen && (
              <OverridesDialog
                user={selectedUser}
                companies={companies ?? []}
              />
            )}
          </Dialog>
        )}
      </section>

      <AlertDialog open={!!toRevoke} onOpenChange={(v) => !v && setToRevoke(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revogar atribuição?</AlertDialogTitle>
            <AlertDialogDescription>
              A role <span className="font-mono">{toRevoke?.role.key}</span> será removida deste usuário
              {toRevoke?.company ? <> em <strong>{toRevoke.company.name}</strong></> : null}.
              A RLS validará a permissão da operação no servidor.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => toRevoke && revoke.mutate(toRevoke.id)}
              disabled={revoke.isPending}
            >Revogar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ---------------- All assignments table ----------------

function AllAssignments({
  grouped, loading, onRevoke,
}: {
  grouped: Array<{ user: RbacAssignment["user"]; rows: RbacAssignment[] }>;
  loading: boolean;
  onRevoke: (a: RbacAssignment) => void;
}) {
  const rows = grouped.flatMap((g) => g.rows);
  const columns: Column<RbacAssignment>[] = [
    {
      key: "user",
      header: "Usuário",
      render: (a) => (
        <div className="flex flex-col">
          <span className="text-sm font-medium text-foreground">{a.user.full_name ?? "(sem nome)"}</span>
          <span className="text-[11px] text-muted-foreground">{a.user.email ?? "—"}</span>
        </div>
      ),
    },
    {
      key: "role",
      header: "Role",
      render: (a) => (
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-3.5 w-3.5 text-muted-foreground" />
          <div className="flex flex-col">
            <span className="text-sm">{a.role.name}</span>
            <span className="font-mono text-[11px] text-muted-foreground">{a.role.key}</span>
          </div>
          <span className={`inline-flex items-center rounded px-1.5 text-[10px] ${scopeTone[a.role.scope]}`}>{a.role.scope}</span>
        </div>
      ),
    },
    {
      key: "context",
      header: "Contexto",
      render: (a) => (
        <div className="flex flex-col text-xs">
          <span>{a.company?.name ?? "—"}</span>
          {a.store?.trade_name && (
            <span className="text-muted-foreground">Loja: {a.store.trade_name}</span>
          )}
        </div>
      ),
    },
    {
      key: "actions",
      header: "",
      className: "text-right whitespace-nowrap",
      render: (a) => (
        <Button size="sm" variant="ghost" onClick={() => onRevoke(a)}>
          <Trash2 className="h-3.5 w-3.5 text-destructive" />
        </Button>
      ),
    },
  ];
  return <DataTable rows={rows} columns={columns} loading={loading} />;
}

// ---------------- Selected user view ----------------

function UserAssignments({
  user, rows, loading, onRevoke,
}: {
  user: Profile;
  rows: RbacAssignment[];
  loading: boolean;
  onRevoke: (a: RbacAssignment) => void;
}) {
  const columns: Column<RbacAssignment>[] = [
    {
      key: "role",
      header: "Role",
      render: (a) => (
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{a.role.name}</span>
          <span className="font-mono text-[11px] text-muted-foreground">{a.role.key}</span>
          <span className={`inline-flex items-center rounded px-1.5 text-[10px] ${scopeTone[a.role.scope]}`}>{a.role.scope}</span>
        </div>
      ),
    },
    {
      key: "company",
      header: "Empresa",
      render: (a) => <span className="text-xs">{a.company?.name ?? "—"}</span>,
    },
    {
      key: "store",
      header: "Loja",
      render: (a) => <span className="text-xs">{a.store?.trade_name ?? "—"}</span>,
    },
    {
      key: "created",
      header: "Atribuída em",
      render: (a) => (
        <span className="text-xs text-muted-foreground">
          {new Date(a.created_at).toLocaleDateString("pt-BR")}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      className: "text-right whitespace-nowrap",
      render: (a) => (
        <Button size="sm" variant="ghost" onClick={() => onRevoke(a)}>
          <Trash2 className="h-3.5 w-3.5 text-destructive" />
        </Button>
      ),
    },
  ];
  return (
    <div className="space-y-3">
      <div className="rounded-md border border-border bg-card p-3 flex items-center gap-2">
        <UserCog className="h-4 w-4 text-muted-foreground" />
        <div className="flex flex-col">
          <span className="text-sm font-medium">{user.full_name ?? "(sem nome)"}</span>
          <span className="text-[11px] text-muted-foreground">{user.email ?? "—"}</span>
        </div>
      </div>
      <DataTable rows={rows} columns={columns} loading={loading} />
    </div>
  );
}

// ---------------- Assign role dialog ----------------

function AssignRoleDialog({
  user, companies, onDone,
}: {
  user: Profile;
  companies: Company[];
  onDone: () => void;
}) {
  const rbac = useServerFn(manageRbac);
  const { toast } = useToast();
  const [roleId, setRoleId] = useState<string>("");
  const [companyId, setCompanyId] = useState<string>("");
  const [storeId, setStoreId] = useState<string>("");

  const { data: roles } = useQuery(rbacRolesQO());
  const role = roles?.find((r) => r.id === roleId) ?? null;

  const { data: stores } = useQuery({
    queryKey: ["rbac", "stores", companyId],
    queryFn: () =>
      rbac({
        data: {
          action: "list_stores",
          ...(companyId ? { company_id: companyId } : {}),
        } as never,
      }) as Promise<Store[]>,
    enabled: !!companyId,
  });

  const assign = useMutation({
    mutationFn: () =>
      rbac({
        data: {
          action: "assign_role",
          user_id: user.id,
          role_id: roleId,
          company_id: role?.scope === "global" ? null : companyId || null,
          store_id: role?.scope === "store" ? (storeId || null) : null,
        } as never,
      }),
    onSuccess: () => {
      toast({ title: "Role atribuída" });
      onDone();
    },
    onError: (e: Error) =>
      toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const needsCompany = role && role.scope !== "global";
  const needsStore = role?.scope === "store";
  const canSubmit = !!role && (!needsCompany || !!companyId) && (!needsStore || !!storeId);

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Atribuir role para {user.full_name ?? user.email}</DialogTitle>
      </DialogHeader>
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label>Role</Label>
          <Select value={roleId} onValueChange={setRoleId}>
            <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
            <SelectContent>
              {(roles ?? []).map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  <span className="font-mono text-[11px] mr-2">{r.key}</span>
                  {r.name} <span className="text-muted-foreground">· {r.scope}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {needsCompany && (
          <div className="space-y-1.5">
            <Label>Empresa</Label>
            <Select value={companyId} onValueChange={(v) => { setCompanyId(v); setStoreId(""); }}>
              <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
              <SelectContent>
                {companies.map((c) => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
        )}

        {needsStore && (
          <div className="space-y-1.5">
            <Label>Loja</Label>
            <Select value={storeId} onValueChange={setStoreId} disabled={!companyId}>
              <SelectTrigger><SelectValue placeholder={companyId ? "Selecione…" : "Selecione a empresa antes"} /></SelectTrigger>
              <SelectContent>
                {(stores ?? []).map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.trade_name ?? s.id.slice(0, 8)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <p className="text-[11px] text-muted-foreground">
          A atribuição é validada pela RLS: roles globais exigem <span className="font-mono">system_admin</span>;
          roles de empresa/loja exigem <span className="font-mono">company_admin</span> na empresa alvo.
        </p>
      </div>
      <DialogFooter>
        <Button disabled={!canSubmit || assign.isPending} onClick={() => assign.mutate()}>Atribuir</Button>
      </DialogFooter>
    </DialogContent>
  );
}

// ---------------- Overrides dialog ----------------

function OverridesDialog({
  user, companies,
}: {
  user: Profile;
  companies: Company[];
}) {
  const qc = useQueryClient();
  const rbac = useServerFn(manageRbac);
  const { toast } = useToast();

  const [companyId, setCompanyId] = useState<string>("__none");
  const [permissionId, setPermissionId] = useState<string>("");
  const [effect, setEffect] = useState<OverrideEffect>("grant");
  const [search, setSearch] = useState("");

  const { data: permissions } = useQuery({
    queryKey: ["rbac", "permissions"],
    queryFn: () =>
      rbac({ data: { action: "list_permissions" } as never }) as Promise<RbacPermission[]>,
  });

  const { data: overrides, isLoading } = useQuery({
    queryKey: ["rbac", "overrides", user.id, companyId],
    queryFn: () =>
      rbac({
        data: {
          action: "list_user_overrides",
          user_id: user.id,
          ...(companyId !== "__none" ? { company_id: companyId } : {}),
        } as never,
      }) as Promise<RbacOverride[]>,
  });

  const filteredPerms = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (permissions ?? []).filter((p) =>
      p.is_active && (!q || p.key.toLowerCase().includes(q) || (p.description ?? "").toLowerCase().includes(q)),
    );
  }, [permissions, search]);

  const create = useMutation({
    mutationFn: () =>
      rbac({
        data: {
          action: "set_user_override",
          user_id: user.id,
          permission_id: permissionId,
          effect,
          company_id: companyId !== "__none" ? companyId : null,
        } as never,
      }),
    onSuccess: () => {
      toast({ title: "Override aplicado" });
      setPermissionId("");
      qc.invalidateQueries({ queryKey: ["rbac", "overrides", user.id] });
    },
    onError: (e: Error) =>
      toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: (id: string) =>
      rbac({ data: { action: "delete_user_override", id } as never }),
    onSuccess: (_d, id) => {
      qc.setQueriesData<RbacOverride[]>({ queryKey: ["rbac", "overrides", user.id] }, (prev) =>
        prev ? prev.filter((o) => o.id !== id) : prev,
      );
      toast({ title: "Override removido" });
    },
    onError: (e: Error) =>
      toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  return (
    <DialogContent className="max-w-2xl">
      <DialogHeader>
        <DialogTitle>Overrides — {user.full_name ?? user.email}</DialogTitle>
      </DialogHeader>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label>Contexto</Label>
          <Select value={companyId} onValueChange={setCompanyId}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none">Global</SelectItem>
              {companies.map((c) => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}
            </SelectContent>
          </Select>
          <p className="text-[11px] text-muted-foreground">
            Overrides globais exigem system_admin; por empresa exigem company_admin (RLS).
          </p>
        </div>

        <div className="grid grid-cols-[1fr,140px,auto] gap-2 items-end">
          <div className="space-y-1.5">
            <Label>Permissão</Label>
            <div className="space-y-1.5">
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filtrar permissões…"
                className="h-8"
              />
              <Select value={permissionId} onValueChange={setPermissionId}>
                <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
                <SelectContent>
                  {filteredPerms.slice(0, 200).map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      <span className="font-mono text-[11px] mr-2">{p.key}</span>
                      <span className="text-muted-foreground">· {p.scope}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Efeito</Label>
            <Select value={effect} onValueChange={(v) => setEffect(v as OverrideEffect)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="grant">grant (conceder)</SelectItem>
                <SelectItem value="deny">deny (negar)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            disabled={!permissionId || create.isPending}
            onClick={() => create.mutate()}
          >Adicionar</Button>
        </div>

        <div className="rounded-md border border-border bg-card max-h-[40vh] overflow-y-auto divide-y divide-border">
          {isLoading && <div className="p-3 text-xs text-muted-foreground">Carregando…</div>}
          {!isLoading && (overrides ?? []).length === 0 && (
            <div className="p-3 text-xs text-muted-foreground">Nenhum override neste contexto.</div>
          )}
          {(overrides ?? []).map((o) => (
            <div key={o.id} className="flex items-center gap-2 p-2">
              {o.effect === "grant" ? (
                <Badge className="bg-primary/15 text-primary gap-1"><ShieldCheck className="h-3 w-3" />grant</Badge>
              ) : (
                <Badge className="bg-destructive/15 text-destructive gap-1"><ShieldOff className="h-3 w-3" />deny</Badge>
              )}
              <span className="font-mono text-xs">{o.permission.key}</span>
              <span className={`inline-flex items-center rounded px-1.5 text-[10px] ${scopeTone[o.permission.scope]}`}>
                {o.permission.scope}
              </span>
              <Button
                size="sm"
                variant="ghost"
                className="ml-auto"
                onClick={() => remove.mutate(o.id)}
                disabled={remove.isPending}
              >
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      </div>
    </DialogContent>
  );
}