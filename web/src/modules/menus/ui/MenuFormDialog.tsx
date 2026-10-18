"use client";

import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Switch } from "@/shared/ui/switch";
import { Button } from "@/shared/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Loader2, Info } from "lucide-react";
import { IconPicker } from "./IconPicker";
import { PermissionCombobox } from "./PermissionCombobox";
import { AVAILABLE_ROLES, type AppRole, type MenuItem, type ModuleOption } from "@/modules/menus/domain/types";

export interface MenuFormValues {
  id?: string;
  name: string;
  icon: string;
  path: string;
  module: string;
  display_order: number;
  is_active: boolean;
  required_role: AppRole | "all";
  required_permission: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: MenuItem | null;
  modules: ModuleOption[];
  permissions: { key: string; module_key: string | null }[];
  defaultModule?: string;
  defaultOrder: number;
  submitting: boolean;
  onSubmit: (v: MenuFormValues) => void;
}

export function MenuFormDialog({
  open, onOpenChange, editing, modules, permissions, defaultModule, defaultOrder, submitting, onSubmit,
}: Props) {
  const [form, setForm] = useState<MenuFormValues>(() => buildInitial(editing, defaultModule, defaultOrder));

  useEffect(() => {
    if (open) setForm(buildInitial(editing, defaultModule, defaultOrder));
  }, [open, editing, defaultModule, defaultOrder]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar menu" : "Novo menu"}</DialogTitle>
          <DialogDescription>
            {editing ? "Atualize as informações do menu" : "Preencha os dados para criar um novo menu"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Nome *</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: Dashboard" />
          </div>

          <div className="space-y-1.5">
            <Label>Módulo *</Label>
            <Select value={form.module} onValueChange={(v) => setForm({ ...form, module: v })}>
              <SelectTrigger><SelectValue placeholder="Selecione um módulo" /></SelectTrigger>
              <SelectContent>
                {modules.length === 0 && (
                  <div className="px-2 py-1.5 text-xs text-muted-foreground">
                    Nenhum módulo ativo. Cadastre em /rbac → Módulos.
                  </div>
                )}
                {modules.map((m) => (
                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {editing && form.module && !modules.some((m) => m.value === form.module) && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                Valor legado <code className="font-mono">{form.module}</code> — selecione um módulo válido para atualizar.
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Ordem</Label>
              <Input type="number" value={form.display_order}
                onChange={(e) => setForm({ ...form, display_order: Number(e.target.value) || 0 })} />
            </div>
            <div className="space-y-1.5">
              <Label>Ativo</Label>
              <div className="flex h-10 items-center"><Switch checked={form.is_active}
                onCheckedChange={(v) => setForm({ ...form, is_active: v })} /></div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Ícone</Label>
            <IconPicker value={form.icon} onChange={(v) => setForm({ ...form, icon: v })} />
          </div>

          <div className="space-y-1.5">
            <Label>Caminho</Label>
            <Input value={form.path} onChange={(e) => setForm({ ...form, path: e.target.value })}
              placeholder="Ex: /dashboard" className="font-mono text-sm" />
          </div>

          <div className="space-y-1.5">
            <Label>Role (legado)</Label>
            <Select value={form.required_role}
              onValueChange={(v) => setForm({ ...form, required_role: v as AppRole | "all" })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos (autenticado)</SelectItem>
                {AVAILABLE_ROLES.map((r) => (
                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Permissão (RBAC novo)</Label>
            <PermissionCombobox value={form.required_permission} options={permissions}
              onChange={(v) => setForm({ ...form, required_permission: v })} />
            {form.required_permission && (
              <div className="flex items-start gap-2 rounded-md border border-primary/30 bg-primary/5 p-2 text-xs text-primary">
                <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span>Permissão tem precedência sobre Role no RBAC novo.</span>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => onSubmit({ ...form, id: editing?.id })}
            disabled={submitting || !form.name.trim() || !form.module}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {editing ? "Salvar" : "Criar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function buildInitial(editing: MenuItem | null, defaultModule: string | undefined, defaultOrder: number): MenuFormValues {
  if (editing) {
    return {
      id: editing.id,
      name: editing.name,
      icon: editing.icon ?? "",
      path: editing.path ?? "",
      module: editing.module || "",
      display_order: editing.display_order,
      is_active: editing.is_active,
      required_role: (editing.required_role ?? "all") as AppRole | "all",
      required_permission: editing.required_permission,
    };
  }
  return {
    name: "", icon: "", path: "",
    module: defaultModule ?? "",
    display_order: defaultOrder,
    is_active: true,
    required_role: "all",
    required_permission: null,
  };
}