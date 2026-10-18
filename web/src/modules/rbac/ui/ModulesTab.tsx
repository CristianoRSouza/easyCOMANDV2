"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@/shared/http/server-fn";
import { manageRbac } from "@/modules/rbac/infrastructure/rbac.functions";
import { rbacModulesQO } from "@/modules/rbac/infrastructure/query-options";
import type { RbacModule } from "@/modules/rbac/domain/types";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Switch } from "@/shared/ui/switch";
import { Textarea } from "@/shared/ui/textarea";
import { Badge } from "@/shared/ui/badge";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/shared/ui/dialog";
import { DataTable, type Column } from "@/shared/layout/data-table";
import { useToast } from "@/shared/hooks/use-toast";
import { Plus, Pencil } from "lucide-react";

export function ModulesTab() {
  const qc = useQueryClient();
  const rbac = useServerFn(manageRbac);
  const { toast } = useToast();
  const { data, isLoading } = useQuery(rbacModulesQO());

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<RbacModule | null>(null);

  const mut = useMutation({
    mutationFn: (vars: { id?: string; key: string; name: string; description: string | null; version: string; is_active: boolean }) =>
      rbac({ data: { action: "upsert_module", ...vars } as never }),
    onSuccess: (data) => {
      const saved = data as RbacModule;
      qc.setQueryData<RbacModule[]>(["rbac", "modules"], (prev) => {
        if (!prev) return prev;
        const exists = prev.some((m) => m.id === saved.id);
        // preserve permission_count se já existir (server não retorna)
        const enriched = {
          ...saved,
          permission_count: prev.find((m) => m.id === saved.id)?.permission_count ?? saved.permission_count ?? 0,
        };
        return exists
          ? prev.map((m) => (m.id === saved.id ? enriched : m))
          : [...prev, enriched];
      });
      toast({ title: "Módulo salvo" });
      setOpen(false); setEditing(null);
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const columns: Column<RbacModule>[] = [
    { key: "key", header: "Key", render: (m) => <span className="font-mono text-xs">{m.key}</span> },
    { key: "name", header: "Nome", render: (m) => <span className="font-medium">{m.name}</span> },
    { key: "version", header: "Versão", render: (m) => <Badge variant="secondary">{m.version}</Badge> },
    { key: "active", header: "Ativo", render: (m) => m.is_active ? <Badge>Sim</Badge> : <Badge variant="outline">Não</Badge> },
    { key: "perms", header: "Permissões", render: (m) => <span className="text-xs">{m.permission_count ?? 0}</span> },
    { key: "actions", header: "", className: "text-right", render: (m) => (
      <Button size="sm" variant="ghost" onClick={() => { setEditing(m); setOpen(true); }}>
        <Pencil className="h-3.5 w-3.5" />
      </Button>
    )},
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{data?.length ?? 0} módulo(s)</p>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}>
          <DialogTrigger asChild>
            <Button size="sm" onClick={() => setEditing(null)}><Plus className="h-3.5 w-3.5 mr-1" />Novo módulo</Button>
          </DialogTrigger>
          <ModuleDialog key={editing?.id ?? "new"} editing={editing} submitting={mut.isPending} onSubmit={(v) => mut.mutate(v)} />
        </Dialog>
      </div>
      <DataTable rows={data} columns={columns} loading={isLoading} />
    </div>
  );
}

function ModuleDialog({
  editing, submitting, onSubmit,
}: {
  editing: RbacModule | null;
  submitting: boolean;
  onSubmit: (v: { id?: string; key: string; name: string; description: string | null; version: string; is_active: boolean }) => void;
}) {
  const [key, setKey] = useState(editing?.key ?? "");
  const [name, setName] = useState(editing?.name ?? "");
  const [description, setDescription] = useState(editing?.description ?? "");
  const [version, setVersion] = useState(editing?.version ?? "1.0.0");
  const [active, setActive] = useState(editing?.is_active ?? true);

  return (
    <DialogContent>
      <DialogHeader><DialogTitle>{editing ? "Editar módulo" : "Novo módulo"}</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label>Key</Label>
          <Input value={key} onChange={(e) => setKey(e.target.value)} disabled={!!editing} placeholder="ex: core" />
        </div>
        <div className="space-y-1.5">
          <Label>Nome</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Descrição</Label>
          <Textarea value={description ?? ""} onChange={(e) => setDescription(e.target.value)} rows={2} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Versão</Label>
            <Input value={version} onChange={(e) => setVersion(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Ativo</Label>
            <div className="flex h-9 items-center"><Switch checked={active} onCheckedChange={setActive} /></div>
          </div>
        </div>
      </div>
      <DialogFooter>
        <Button
          disabled={submitting || !key || !name}
          onClick={() => onSubmit({ id: editing?.id, key, name, description: description || null, version, is_active: active })}
        >Salvar</Button>
      </DialogFooter>
    </DialogContent>
  );
}