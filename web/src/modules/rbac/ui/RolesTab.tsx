"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@/shared/http/server-fn";
import { manageRbac } from "@/modules/rbac/infrastructure/rbac.functions";
import {
  rbacModulesQO,
  rbacPermissionsQO,
  rbacRolesQO,
} from "@/modules/rbac/infrastructure/query-options";
import type { RbacModule, RbacPermission, RbacRole, RbacScope } from "@/modules/rbac/domain/types";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Textarea } from "@/shared/ui/textarea";
import { Badge } from "@/shared/ui/badge";
import { Checkbox } from "@/shared/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/shared/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/shared/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/shared/ui/alert-dialog";
import { DataTable, type Column } from "@/shared/layout/data-table";
import { useToast } from "@/shared/hooks/use-toast";
import { Plus, Pencil, Trash2, Copy, Lock, ShieldCheck } from "lucide-react";

const scopeTone: Record<RbacScope, string> = {
  global: "bg-primary/15 text-primary",
  company: "bg-warning/15 text-warning",
  store: "bg-muted text-muted-foreground",
};

export function RolesTab() {
  const qc = useQueryClient();
  const rbac = useServerFn(manageRbac);
  const { toast } = useToast();

  const { data: roles, isLoading } = useQuery(rbacRolesQO());
  const { data: permissions } = useQuery(rbacPermissionsQO());
  const { data: modules } = useQuery(rbacModulesQO());

  const [scopeFilter, setScopeFilter] = useState<string>("__all");
  const filtered = useMemo(
    () => (roles ?? []).filter((r) => scopeFilter === "__all" || r.scope === scopeFilter),
    [roles, scopeFilter],
  );

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<RbacRole | null>(null);
  const [toDelete, setToDelete] = useState<RbacRole | null>(null);
  const [dupFrom, setDupFrom] = useState<RbacRole | null>(null);

  const upsert = useMutation({
    mutationFn: (v: {
      id?: string; key: string; name: string; description: string | null;
      scope: RbacScope; permission_ids: string[];
    }) => rbac({ data: { action: "upsert_role", ...v } as never }),
    onSuccess: (data, vars) => {
      const created = data as { id: string } | null;
      const permKeyMap = new Map((permissions ?? []).map((p) => [p.id, p.key]));
      const permission_keys = vars.permission_ids.map((id) => permKeyMap.get(id) ?? "").filter(Boolean);
      qc.setQueryData<RbacRole[]>(["rbac", "roles"], (prev) => {
        if (!prev) return prev;
        if (vars.id) {
          // update
          return prev.map((r) =>
            r.id === vars.id
              ? {
                  ...r,
                  key: vars.key,
                  name: vars.name,
                  description: vars.description,
                  scope: vars.scope,
                  permission_ids: vars.permission_ids,
                  permission_keys,
                }
              : r,
          );
        }
        const newId = created?.id;
        if (!newId) return prev;
        const newRow: RbacRole = {
          id: newId,
          key: vars.key,
          name: vars.name,
          description: vars.description,
          scope: vars.scope,
          is_system: false,
          permission_ids: vars.permission_ids,
          permission_keys,
        };
        return [...prev, newRow];
      });
      // role_count em permissions pode ter mudado → invalida só esse
      qc.invalidateQueries({ queryKey: ["rbac", "permissions"] });
      toast({ title: "Role salva" });
      setEditorOpen(false); setEditing(null);
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const duplicate = useMutation({
    mutationFn: (v: { source_id: string; new_key: string; new_name: string }) =>
      rbac({ data: { action: "duplicate_role", ...v } as never }),
    onSuccess: (data, vars) => {
      const created = data as { id: string } | null;
      qc.setQueryData<RbacRole[]>(["rbac", "roles"], (prev) => {
        if (!prev || !created?.id) return prev;
        const src = prev.find((r) => r.id === vars.source_id);
        if (!src) return prev;
        return [
          ...prev,
          {
            ...src,
            id: created.id,
            key: vars.new_key,
            name: vars.new_name,
            is_system: false,
          },
        ];
      });
      toast({ title: "Role duplicada" });
      setDupFrom(null);
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const del = useMutation({
    mutationFn: (id: string) => rbac({ data: { action: "delete_role", id } as never }),
    onSuccess: (_d, id) => {
      qc.setQueryData<RbacRole[]>(["rbac", "roles"], (prev) =>
        prev ? prev.filter((r) => r.id !== id) : prev,
      );
      toast({ title: "Role excluída" });
      setToDelete(null);
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const columns: Column<RbacRole>[] = [
    {
      key: "name",
      header: "Role",
      render: (r) => (
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-3.5 w-3.5 text-muted-foreground" />
          <div className="flex flex-col">
            <span className="text-sm font-medium text-foreground">{r.name}</span>
            <span className="font-mono text-[11px] text-muted-foreground">{r.key}</span>
          </div>
        </div>
      ),
    },
    {
      key: "scope",
      header: "Escopo",
      render: (r) => (
        <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${scopeTone[r.scope]}`}>{r.scope}</span>
      ),
    },
    {
      key: "perms",
      header: "Permissões",
      render: (r) => <span className="text-xs text-muted-foreground">{r.permission_ids.length}</span>,
    },
    {
      key: "system",
      header: "Tipo",
      render: (r) =>
        r.is_system ? (
          <Badge variant="outline" className="gap-1 text-[11px]"><Lock className="h-3 w-3" />Sistema</Badge>
        ) : (
          <Badge variant="secondary" className="text-[11px]">Custom</Badge>
        ),
    },
    {
      key: "actions",
      header: "",
      className: "text-right whitespace-nowrap",
      render: (r) => (
        <div className="flex items-center justify-end gap-1">
          <Button size="sm" variant="ghost" title="Editar" onClick={() => { setEditing(r); setEditorOpen(true); }}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" variant="ghost" title="Duplicar" onClick={() => setDupFrom(r)}>
            <Copy className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            title={r.is_system ? "Roles de sistema não podem ser excluídas" : "Excluir"}
            disabled={r.is_system}
            onClick={() => setToDelete(r)}
          >
            <Trash2 className={`h-3.5 w-3.5 ${r.is_system ? "text-muted-foreground" : "text-destructive"}`} />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <Label className="text-[11px] uppercase text-muted-foreground">Escopo</Label>
          <Select value={scopeFilter} onValueChange={setScopeFilter}>
            <SelectTrigger className="w-36 h-8"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">Todos</SelectItem>
              <SelectItem value="global">global</SelectItem>
              <SelectItem value="company">company</SelectItem>
              <SelectItem value="store">store</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button size="sm" onClick={() => { setEditing(null); setEditorOpen(true); }}>
          <Plus className="h-3.5 w-3.5 mr-1" />Nova role
        </Button>
      </div>

      <DataTable rows={filtered} columns={columns} loading={isLoading} />

      <Dialog open={editorOpen} onOpenChange={(v) => { setEditorOpen(v); if (!v) setEditing(null); }}>
        {editorOpen && (
          <RoleEditorDialog
            editing={editing}
            modules={modules ?? []}
            permissions={permissions ?? []}
            submitting={upsert.isPending}
            onSubmit={(v) => upsert.mutate(v)}
          />
        )}
      </Dialog>

      <Dialog open={!!dupFrom} onOpenChange={(v) => !v && setDupFrom(null)}>
        {dupFrom && (
          <DuplicateRoleDialog
            source={dupFrom}
            submitting={duplicate.isPending}
            onSubmit={(v) => duplicate.mutate({ source_id: dupFrom.id, ...v })}
          />
        )}
      </Dialog>

      <AlertDialog open={!!toDelete} onOpenChange={(v) => !v && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir role?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-mono">{toDelete?.key}</span> e todas as suas atribuições serão removidas. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => toDelete && del.mutate(toDelete.id)}
              disabled={del.isPending}
            >Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ---------------- Editor ----------------

function RoleEditorDialog({
  editing, modules, permissions, submitting, onSubmit,
}: {
  editing: RbacRole | null;
  modules: RbacModule[];
  permissions: RbacPermission[];
  submitting: boolean;
  onSubmit: (v: {
    id?: string; key: string; name: string; description: string | null;
    scope: RbacScope; permission_ids: string[];
  }) => void;
}) {
  const locked = !!editing?.is_system;
  const [key, setKey] = useState(editing?.key ?? "");
  const [name, setName] = useState(editing?.name ?? "");
  const [description, setDescription] = useState(editing?.description ?? "");
  const [scope, setScope] = useState<RbacScope>(editing?.scope ?? "company");
  const [selected, setSelected] = useState<Set<string>>(new Set(editing?.permission_ids ?? []));
  const [search, setSearch] = useState("");

  const byModule = useMemo(() => {
    const groups = new Map<string, RbacPermission[]>();
    const term = search.trim().toLowerCase();
    for (const p of permissions) {
      if (!p.is_active) continue;
      if (term && !p.key.toLowerCase().includes(term) && !(p.description ?? "").toLowerCase().includes(term)) continue;
      const k = p.module_key ?? "—";
      const list = groups.get(k) ?? [];
      list.push(p);
      groups.set(k, list);
    }
    return groups;
  }, [permissions, search]);

  const moduleList = useMemo(() => {
    const known = new Map(modules.map((m) => [m.key, m.name] as const));
    return Array.from(byModule.keys()).sort().map((k) => ({
      key: k,
      name: known.get(k) ?? k,
      items: byModule.get(k)!,
    }));
  }, [byModule, modules]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  const toggleModule = (items: RbacPermission[], on: boolean) => {
    setSelected((prev) => {
      const n = new Set(prev);
      for (const it of items) on ? n.add(it.id) : n.delete(it.id);
      return n;
    });
  };

  const canSave = key.trim().length > 0 && name.trim().length > 0;

  return (
    <DialogContent className="max-w-3xl">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          {editing ? "Editar role" : "Nova role"}
          {locked && <Badge variant="outline" className="gap-1 text-[11px]"><Lock className="h-3 w-3" />Sistema</Badge>}
        </DialogTitle>
      </DialogHeader>

      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Key</Label>
            <Input
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="ex: store_manager"
              disabled={locked}
            />
            {locked && <p className="text-[11px] text-muted-foreground">Key bloqueada para roles de sistema.</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Nome</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ex: Gerente de Loja"
              disabled={locked}
            />
            {locked && <p className="text-[11px] text-muted-foreground">Nome bloqueado para roles de sistema.</p>}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Escopo</Label>
            <Select value={scope} onValueChange={(v) => setScope(v as RbacScope)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="global">global</SelectItem>
                <SelectItem value="company">company</SelectItem>
                <SelectItem value="store">store</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Descrição</Label>
            <Textarea
              value={description ?? ""}
              onChange={(e) => setDescription(e.target.value)}
              rows={1}
            />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Label>Matriz de permissões</Label>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filtrar permissões…"
              className="h-8 w-60"
            />
          </div>
          <div className="rounded-md border border-border bg-card max-h-[42vh] overflow-y-auto divide-y divide-border">
            {moduleList.length === 0 && (
              <div className="p-6 text-center text-sm text-muted-foreground">Nenhuma permissão encontrada.</div>
            )}
            {moduleList.map((mod) => {
              const allOn = mod.items.every((p) => selected.has(p.id));
              const someOn = !allOn && mod.items.some((p) => selected.has(p.id));
              return (
                <div key={mod.key} className="p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={allOn ? true : someOn ? "indeterminate" : false}
                        onCheckedChange={(v) => toggleModule(mod.items, v === true)}
                      />
                      <span className="text-sm font-medium text-foreground">{mod.name}</span>
                      <span className="font-mono text-[11px] text-muted-foreground">{mod.key}</span>
                    </div>
                    <span className="text-[11px] text-muted-foreground">
                      {mod.items.filter((p) => selected.has(p.id)).length} / {mod.items.length}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 pl-6">
                    {mod.items.map((p) => (
                      <label
                        key={p.id}
                        className="flex items-start gap-2 rounded px-2 py-1 hover:bg-muted/40 cursor-pointer"
                      >
                        <Checkbox
                          checked={selected.has(p.id)}
                          onCheckedChange={() => toggle(p.id)}
                          className="mt-0.5"
                        />
                        <div className="flex flex-col min-w-0">
                          <span className="font-mono text-[11px] text-foreground truncate">{p.key}</span>
                          {p.description && (
                            <span className="text-[11px] text-muted-foreground truncate">{p.description}</span>
                          )}
                        </div>
                        <span className={`ml-auto inline-flex items-center rounded px-1.5 text-[10px] ${scopeTone[p.scope]}`}>{p.scope}</span>
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-[11px] text-muted-foreground">{selected.size} permissão(ões) selecionada(s).</p>
        </div>
      </div>

      <DialogFooter>
        <Button
          disabled={submitting || !canSave}
          onClick={() =>
            onSubmit({
              id: editing?.id,
              key: key.trim(),
              name: name.trim(),
              description: description?.trim() ? description.trim() : null,
              scope,
              permission_ids: Array.from(selected),
            })
          }
        >Salvar</Button>
      </DialogFooter>
    </DialogContent>
  );
}

// ---------------- Duplicate ----------------

function DuplicateRoleDialog({
  source, submitting, onSubmit,
}: {
  source: RbacRole;
  submitting: boolean;
  onSubmit: (v: { new_key: string; new_name: string }) => void;
}) {
  const [newKey, setNewKey] = useState(`${source.key}_copy`);
  const [newName, setNewName] = useState(`${source.name} (cópia)`);
  const ok = newKey.trim().length > 0 && newName.trim().length > 0;
  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Duplicar role</DialogTitle>
      </DialogHeader>
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Criando uma cópia de <span className="font-mono">{source.key}</span> com todas as suas permissões. A nova role não será marcada como sistema.
        </p>
        <div className="space-y-1.5">
          <Label>Nova key</Label>
          <Input value={newKey} onChange={(e) => setNewKey(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Novo nome</Label>
          <Input value={newName} onChange={(e) => setNewName(e.target.value)} />
        </div>
      </div>
      <DialogFooter>
        <Button
          disabled={!ok || submitting}
          onClick={() => onSubmit({ new_key: newKey.trim(), new_name: newName.trim() })}
        >Duplicar</Button>
      </DialogFooter>
    </DialogContent>
  );
}