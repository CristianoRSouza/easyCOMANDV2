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
import { AVAILABLE_ROLES, type AppRole, type SubmenuItem } from "@/modules/menus/domain/types";

export interface SubmenuFormValues {
  id?: string;
  menu_id: string;
  name: string;
  path: string;
  icon: string;
  display_order: number;
  is_active: boolean;
  parent_submenu_id: string | null;
  required_role: AppRole | "all";
  required_permission: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: SubmenuItem | null;
  menuId: string;
  siblingsForParent: SubmenuItem[];
  permissions: { key: string; module_key: string | null }[];
  defaultParent: string | null;
  defaultOrder: number;
  submitting: boolean;
  onSubmit: (v: SubmenuFormValues) => void;
}

export function SubmenuFormDialog({
  open, onOpenChange, editing, menuId, siblingsForParent, permissions,
  defaultParent, defaultOrder, submitting, onSubmit,
}: Props) {
  const [form, setForm] = useState<SubmenuFormValues>(() =>
    buildInitial(editing, menuId, defaultParent, defaultOrder),
  );

  useEffect(() => {
    if (open) setForm(buildInitial(editing, menuId, defaultParent, defaultOrder));
  }, [open, editing, menuId, defaultParent, defaultOrder]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar submenu" : "Novo submenu"}</DialogTitle>
          <DialogDescription>
            {editing ? "Atualize as informações do submenu" : "Preencha os dados para criar um submenu"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Submenu pai (opcional)</Label>
            <Select value={form.parent_submenu_id ?? "none"}
              onValueChange={(v) => setForm({ ...form, parent_submenu_id: v === "none" ? null : v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhum (raiz)</SelectItem>
                {siblingsForParent.filter((s) => s.id !== editing?.id).map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Nome *</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>

          <div className="space-y-1.5">
            <Label>Caminho *</Label>
            <Input value={form.path} onChange={(e) => setForm({ ...form, path: e.target.value })}
              placeholder="Ex: /dashboard/produtos" className="font-mono text-sm" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Ordem</Label>
              <Input type="number" value={form.display_order}
                onChange={(e) => setForm({ ...form, display_order: Number(e.target.value) || 0 })} />
            </div>
            <div className="space-y-1.5">
              <Label>Ativo</Label>
              <div className="flex h-10 items-center">
                <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Ícone</Label>
            <IconPicker value={form.icon} onChange={(v) => setForm({ ...form, icon: v })} />
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
            disabled={submitting || !form.name.trim() || !form.path.trim()}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {editing ? "Salvar" : "Criar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function buildInitial(
  editing: SubmenuItem | null,
  menuId: string,
  defaultParent: string | null,
  defaultOrder: number,
): SubmenuFormValues {
  if (editing) {
    return {
      id: editing.id,
      menu_id: editing.menu_id,
      name: editing.name,
      path: editing.path,
      icon: editing.icon ?? "",
      display_order: editing.display_order,
      is_active: editing.is_active,
      parent_submenu_id: editing.parent_submenu_id,
      required_role: (editing.required_role ?? "all") as AppRole | "all",
      required_permission: editing.required_permission,
    };
  }
  return {
    menu_id: menuId,
    name: "", path: "", icon: "",
    display_order: defaultOrder,
    is_active: true,
    parent_submenu_id: defaultParent,
    required_role: "all",
    required_permission: null,
  };
}