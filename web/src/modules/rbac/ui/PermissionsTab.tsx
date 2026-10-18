"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@/shared/http/server-fn";
import { manageRbac } from "@/modules/rbac/infrastructure/rbac.functions";
import { rbacModulesQO, rbacPermissionsQO } from "@/modules/rbac/infrastructure/query-options";
import { PERMISSION_KEY_REGEX, type RbacModule, type RbacPermission, type RbacScope } from "@/modules/rbac/domain/types";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Textarea } from "@/shared/ui/textarea";
import { Badge } from "@/shared/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Switch } from "@/shared/ui/switch";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/shared/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/shared/ui/alert-dialog";
import { DataTable, type Column } from "@/shared/layout/data-table";
import { useToast } from "@/shared/hooks/use-toast";
import { Plus, Pencil, Trash2 } from "lucide-react";

const scopeTone: Record<RbacScope, string> = {
  global: "bg-primary/15 text-primary",
  company: "bg-warning/15 text-warning",
  store: "bg-muted text-muted-foreground",
};

export function PermissionsTab() {
  const qc = useQueryClient();
  const rbac = useServerFn(manageRbac);
  const { toast } = useToast();
  const { data: perms, isLoading } = useQuery(rbacPermissionsQO());
  const { data: modules } = useQuery(rbacModulesQO());

  const [moduleFilter, setModuleFilter] = useState<string>("__all");
  const [scopeFilter, setScopeFilter] = useState<string>("__all");

  const filtered = useMemo(() => {
    return (perms ?? []).filter((p) => {
      if (moduleFilter !== "__all" && p.module_key !== moduleFilter) return false;
      if (scopeFilter !== "__all" && p.scope !== scopeFilter) return false;
      return true;
    });
  }, [perms, moduleFilter, scopeFilter]);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<RbacPermission | null>(null);
  const [toDelete, setToDelete] = useState<RbacPermission | null>(null);

  const upsert = useMutation({
    mutationFn: (v: { id?: string; key: string; module_key: string; scope: RbacScope; description: string | null; is_active: boolean }) =>
      rbac({ data: { action: "upsert_permission", ...v } as never }),
    onSuccess: (data) => {
      const saved = data as RbacPermission;
      qc.setQueryData<RbacPermission[]>(["rbac", "permissions"], (prev) => {
        if (!prev) return prev;
        const exists = prev.some((p) => p.id === saved.id);
        const enriched = {
          ...saved,
          role_count: prev.find((p) => p.id === saved.id)?.role_count ?? 0,
        };
        return exists
          ? prev.map((p) => (p.id === saved.id ? enriched : p))
          : [...prev, enriched];
      });
      toast({ title: "Permissão salva" });
      setOpen(false); setEditing(null);
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const del = useMutation({
    mutationFn: (id: string) => rbac({ data: { action: "delete_permission", id } as never }),
    onSuccess: (_d, id) => {
      qc.setQueryData<RbacPermission[]>(["rbac", "permissions"], (prev) =>
        prev ? prev.filter((p) => p.id !== id) : prev,
      );
      toast({ title: "Permissão excluída" });
      setToDelete(null);
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const columns: Column<RbacPermission>[] = [
    { key: "key", header: "Key", render: (p) => <span className="font-mono text-xs">{p.key}</span> },
    { key: "module", header: "Módulo", render: (p) => <span className="text-xs text-muted-foreground">{p.module_key ?? "—"}</span> },
    { key: "scope", header: "Escopo", render: (p) => (
      <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${scopeTone[p.scope]}`}>{p.scope}</span>
    )},
    { key: "desc", header: "Descrição", render: (p) => <span className="text-xs text-muted-foreground">{p.description ?? "—"}</span> },
    { key: "roles", header: "Roles", render: (p) => <span className="text-xs">{p.role_count ?? 0}</span> },
    { key: "actions", header: "", className: "text-right whitespace-nowrap", render: (p) => (
      <div className="flex items-center justify-end gap-1">
        <Button size="sm" variant="ghost" onClick={() => { setEditing(p); setOpen(true); }}>
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setToDelete(p)}>
          <Trash2 className="h-3.5 w-3.5 text-destructive" />
        </Button>
      </div>
    )},
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <Label className="text-[11px] uppercase text-muted-foreground">Módulo</Label>
            <Select value={moduleFilter} onValueChange={setModuleFilter}>
              <SelectTrigger className="w-44 h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all">Todos</SelectItem>
                {(modules ?? []).map((m) => (<SelectItem key={m.key} value={m.key}>{m.name}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
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
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}>
          <DialogTrigger asChild>
            <Button size="sm" onClick={() => setEditing(null)}><Plus className="h-3.5 w-3.5 mr-1" />Nova permissão</Button>
          </DialogTrigger>
          <PermissionDialog key={editing?.id ?? "new"} editing={editing} modules={modules ?? []} submitting={upsert.isPending} onSubmit={(v) => upsert.mutate(v)} />
        </Dialog>
      </div>
      <DataTable rows={filtered} columns={columns} loading={isLoading} />

      <AlertDialog open={!!toDelete} onOpenChange={(v) => !v && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir permissão?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-mono">{toDelete?.key}</span> será removida. Esta ação não pode ser desfeita.
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

function PermissionDialog({
  editing, modules, submitting, onSubmit,
}: {
  editing: RbacPermission | null;
  modules: RbacModule[];
  submitting: boolean;
  onSubmit: (v: { id?: string; key: string; module_key: string; scope: RbacScope; description: string | null; is_active: boolean }) => void;
}) {
  const [key, setKey] = useState(editing?.key ?? "");
  const [moduleKey, setModuleKey] = useState(editing?.module_key ?? "");
  const [scope, setScope] = useState<RbacScope>(editing?.scope ?? "company");
  const [description, setDescription] = useState(editing?.description ?? "");
  const [active, setActive] = useState(editing?.is_active ?? true);
  const keyValid = PERMISSION_KEY_REGEX.test(key);

  return (
    <DialogContent>
      <DialogHeader><DialogTitle>{editing ? "Editar permissão" : "Nova permissão"}</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label>Key</Label>
          <Input value={key} onChange={(e) => setKey(e.target.value)} placeholder="ex: core.users.read" />
          {key && !keyValid && (
            <p className="text-[11px] text-destructive">Formato inválido. Use <code className="font-mono">module.action</code> ou <code className="font-mono">module.*</code>.</p>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Módulo</Label>
            <Select value={moduleKey} onValueChange={setModuleKey}>
              <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
              <SelectContent>
                {modules.map((m) => (<SelectItem key={m.key} value={m.key}>{m.name}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
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
        </div>
        <div className="space-y-1.5">
          <Label>Descrição</Label>
          <Textarea value={description ?? ""} onChange={(e) => setDescription(e.target.value)} rows={2} />
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={active} onCheckedChange={setActive} />
          <Label className="text-sm">Ativa</Label>
        </div>
      </div>
      <DialogFooter>
        <Button
          disabled={submitting || !keyValid || !moduleKey}
          onClick={() => onSubmit({ id: editing?.id, key, module_key: moduleKey, scope, description: description || null, is_active: active })}
        >Salvar</Button>
      </DialogFooter>
    </DialogContent>
  );
}