"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@/shared/http/server-fn";
import {
  DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Plus, Pencil, Trash2, ChevronRight, GripVertical, LayoutList, FolderTree,
} from "lucide-react";
import { PageHeader } from "@/shared/layout/page-header";
import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/shared/ui/card";
import { Label } from "@/shared/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/shared/ui/alert-dialog";
import { useToast } from "@/shared/hooks/use-toast";
import { manageMenus } from "@/modules/menus/infrastructure/menus.functions";
import type { MenuItem, SubmenuItem, ModuleOption } from "@/modules/menus/domain/types";
import { getIconComponent } from "@/modules/menus/ui/IconPicker";
import { MenuFormDialog, type MenuFormValues } from "@/modules/menus/ui/MenuFormDialog";
import { SubmenuFormDialog, type SubmenuFormValues } from "@/modules/menus/ui/SubmenuFormDialog";

const ACCESS_KEY = ["menus-admin", "check_access"] as const;
const LIST_KEY_STATIC = ["menus-admin", "list"] as const;


export function MenusPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const fn = useServerFn(manageMenus);

  const menusQ = useQuery({
    queryKey: LIST_KEY_STATIC,
    queryFn: () => fn({ data: { action: "list_menus" } as never }) as Promise<{ menus: MenuItem[]; submenus: SubmenuItem[] }>,
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
  const accessQ = useQuery({
    queryKey: ACCESS_KEY,
    queryFn: () =>
      fn({ data: { action: "check_access" } as never }) as Promise<{ allowed: boolean }>,
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    refetchOnWindowFocus: false,
  });
  // Soft-gate: redirect if server confirms no access (matches old beforeLoad).
  useEffect(() => {
    if (accessQ.data && accessQ.data.allowed === false) {
      window.location.assign("/dashboard");
    }
  }, [accessQ.data]);
  const permsQ = useQuery({
    queryKey: ["menus-admin", "permissions"],
    queryFn: () => fn({ data: { action: "list_permissions" } as never }) as Promise<{ key: string; module_key: string | null }[]>,
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
  const modulesQ = useQuery({
    queryKey: ["menus-admin", "modules"],
    queryFn: () => fn({ data: { action: "list_modules" } as never }) as Promise<ModuleOption[]>,
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  const LIST_KEY = LIST_KEY_STATIC;
  type ListData = { menus: MenuItem[]; submenus: SubmenuItem[] };
  const patchList = (updater: (prev: ListData) => ListData) => {
    qc.setQueryData<ListData>(LIST_KEY, (prev) => (prev ? updater(prev) : prev));
  };
  const invalidateSidebars = () => {
    qc.invalidateQueries({ queryKey: ["menu-data"] });
    qc.invalidateQueries({ queryKey: ["route-access-map"] });
  };

  const onError = (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" });

  const upsertMenu = useMutation({
    mutationFn: (v: MenuFormValues) => fn({ data: {
      action: "upsert_menu",
      id: v.id, name: v.name, icon: v.icon || null, path: v.path || null,
      module: v.module, display_order: v.display_order, is_active: v.is_active,
      required_role: v.required_role === "all" ? null : v.required_role,
      required_permission: v.required_permission || null,
    } as never }),
    onSuccess: (data) => {
      const saved = data as MenuItem;
      patchList((prev) => {
        const exists = prev.menus.some((m) => m.id === saved.id);
        return {
          ...prev,
          menus: exists
            ? prev.menus.map((m) => (m.id === saved.id ? saved : m))
            : [...prev.menus, saved].sort((a, b) => a.display_order - b.display_order),
        };
      });
      invalidateSidebars();
      toast({ title: "Menu salvo" });
      setMenuDlg({ open: false, editing: null });
    },
    onError,
  });
  const deleteMenu = useMutation({
    mutationFn: (id: string) => fn({ data: { action: "delete_menu", id } as never }),
    onSuccess: (_d, id) => {
      patchList((prev) => ({
        menus: prev.menus.filter((m) => m.id !== id),
        submenus: prev.submenus.filter((s) => s.menu_id !== id),
      }));
      invalidateSidebars();
      toast({ title: "Menu excluído" });
      setDeleteTarget(null);
    },
    onError,
  });
  const reorderMenus = useMutation({
    mutationFn: (rows: { id: string; display_order: number }[]) =>
      fn({ data: { action: "reorder_menus", rows } as never }),
    onMutate: (rows) => {
      const orderMap = new Map(rows.map((r) => [r.id, r.display_order]));
      const prev = qc.getQueryData<ListData>(LIST_KEY);
      patchList((p) => ({
        ...p,
        menus: [...p.menus]
          .map((m) => (orderMap.has(m.id) ? { ...m, display_order: orderMap.get(m.id)! } : m))
          .sort((a, b) => a.display_order - b.display_order),
      }));
      return { prev };
    },
    onError: (e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(LIST_KEY, ctx.prev);
      onError(e as Error);
    },
    onSuccess: () => { invalidateSidebars(); },
  });
  const upsertSubmenu = useMutation({
    mutationFn: (v: SubmenuFormValues) => fn({ data: {
      action: "upsert_submenu",
      id: v.id, menu_id: v.menu_id, name: v.name, path: v.path, icon: v.icon || null,
      display_order: v.display_order, is_active: v.is_active,
      parent_submenu_id: v.parent_submenu_id,
      required_role: v.required_role === "all" ? null : v.required_role,
      required_permission: v.required_permission || null,
    } as never }),
    onSuccess: (data) => {
      const saved = data as SubmenuItem;
      patchList((prev) => {
        const exists = prev.submenus.some((s) => s.id === saved.id);
        return {
          ...prev,
          submenus: exists
            ? prev.submenus.map((s) => (s.id === saved.id ? saved : s))
            : [...prev.submenus, saved],
        };
      });
      invalidateSidebars();
      toast({ title: "Submenu salvo" });
      setSubDlg(null);
    },
    onError,
  });
  const deleteSubmenu = useMutation({
    mutationFn: (id: string) => fn({ data: { action: "delete_submenu", id } as never }),
    onSuccess: (_d, id) => {
      patchList((prev) => ({
        ...prev,
        submenus: prev.submenus.filter((s) => s.id !== id && s.parent_submenu_id !== id),
      }));
      invalidateSidebars();
      toast({ title: "Submenu excluído" });
      setDeleteTarget(null);
    },
    onError,
  });
  const reorderSubmenus = useMutation({
    mutationFn: (v: { menu_id: string; rows: { id: string; display_order: number }[] }) =>
      fn({ data: { action: "reorder_submenus", ...v } as never }),
    onMutate: (v) => {
      const orderMap = new Map(v.rows.map((r) => [r.id, r.display_order]));
      const prev = qc.getQueryData<ListData>(LIST_KEY);
      patchList((p) => ({
        ...p,
        submenus: p.submenus.map((s) =>
          orderMap.has(s.id) ? { ...s, display_order: orderMap.get(s.id)! } : s,
        ),
      }));
      return { prev };
    },
    onError: (e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(LIST_KEY, ctx.prev);
      onError(e as Error);
    },
    onSuccess: () => { invalidateSidebars(); },
  });

  const [moduleFilter, setModuleFilter] = useState<string>("all");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [menuDlg, setMenuDlg] = useState<{ open: boolean; editing: MenuItem | null }>({ open: false, editing: null });
  const [subDlg, setSubDlg] = useState<{ menuId: string; editing: SubmenuItem | null; parent: string | null } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ type: "menu" | "submenu"; id: string; name: string } | null>(null);

  const menus = menusQ.data?.menus ?? [];
  const submenus = menusQ.data?.submenus ?? [];
  const filtered = useMemo(
    () => moduleFilter === "all" ? menus : menus.filter((m) => m.module === moduleFilter),
    [menus, moduleFilter],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const toggle = (id: string) => setExpanded((p) => {
    const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n;
  });

  const handleMenuDrag = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldI = filtered.findIndex((m) => m.id === active.id);
    const newI = filtered.findIndex((m) => m.id === over.id);
    if (oldI < 0 || newI < 0) return;
    const re = arrayMove(filtered, oldI, newI);
    reorderMenus.mutate(re.map((m, i) => ({ id: m.id, display_order: i })));
  };

  const handleSubDrag = (menuId: string, list: SubmenuItem[]) => (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldI = list.findIndex((s) => s.id === active.id);
    const newI = list.findIndex((s) => s.id === over.id);
    if (oldI < 0 || newI < 0) return;
    const re = arrayMove(list, oldI, newI);
    reorderSubmenus.mutate({ menu_id: menuId, rows: re.map((s, i) => ({ id: s.id, display_order: i })) });
  };

  const isInitialLoading = menusQ.isLoading && !menusQ.data;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Gerenciar Menus"
        description="Organize a navegação dos apps do ecossistema (pb_menus / pb_submenus)."
        icon={LayoutList}
      />

      <Card>
        <CardHeader className="border-b bg-muted/30">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base">Menus e Submenus</CardTitle>
              <CardDescription>Arraste para reordenar. Cliques em + adicionam submenus.</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground whitespace-nowrap">Módulo:</Label>
              <Select value={moduleFilter} onValueChange={setModuleFilter}>
                <SelectTrigger className="w-[180px] h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos ({menus.length})</SelectItem>
                  {(modulesQ.data ?? []).map((m) => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button size="sm" onClick={() => setMenuDlg({ open: true, editing: null })}>
                <Plus className="h-3.5 w-3.5 mr-1" />Novo
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4">
          {isInitialLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-14 rounded-lg border bg-muted/20 animate-pulse" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-sm text-muted-foreground">Nenhum menu cadastrado.</div>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleMenuDrag}>
              <SortableContext items={filtered.map((m) => m.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-2">
                  {filtered.map((menu) => {
                    const subs = submenus.filter((s) => s.menu_id === menu.id);
                    return (
                      <SortableMenuRow
                        key={menu.id}
                        menu={menu}
                        subs={subs}
                        sensors={sensors}
                        expanded={expanded.has(menu.id)}
                        onToggle={() => toggle(menu.id)}
                        onEdit={() => setMenuDlg({ open: true, editing: menu })}
                        onDelete={() => setDeleteTarget({ type: "menu", id: menu.id, name: menu.name })}
                        onAddSub={(parent) => setSubDlg({ menuId: menu.id, editing: null, parent })}
                        onEditSub={(s) => setSubDlg({ menuId: menu.id, editing: s, parent: s.parent_submenu_id })}
                        onDeleteSub={(s) => setDeleteTarget({ type: "submenu", id: s.id, name: s.name })}
                        onSubDrag={handleSubDrag}
                      />
                    );
                  })}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </CardContent>
      </Card>

      <MenuFormDialog
        open={menuDlg.open}
        onOpenChange={(v) => setMenuDlg({ open: v, editing: v ? menuDlg.editing : null })}
        editing={menuDlg.editing}
        modules={modulesQ.data ?? []}
        permissions={permsQ.data ?? []}
        defaultModule={moduleFilter !== "all" ? moduleFilter : undefined}
        defaultOrder={menus.length}
        submitting={upsertMenu.isPending}
        onSubmit={(v) => upsertMenu.mutate(v)}
      />

      {subDlg && (
        <SubmenuFormDialog
          open={!!subDlg}
          onOpenChange={(v) => { if (!v) setSubDlg(null); }}
          editing={subDlg.editing}
          menuId={subDlg.menuId}
          siblingsForParent={submenus.filter((s) => s.menu_id === subDlg.menuId)}
          permissions={permsQ.data ?? []}
          defaultParent={subDlg.parent}
          defaultOrder={submenus.filter((s) => s.menu_id === subDlg.menuId && s.parent_submenu_id === subDlg.parent).length}
          submitting={upsertSubmenu.isPending}
          onSubmit={(v) => upsertSubmenu.mutate(v)}
        />
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir <strong>{deleteTarget?.name}</strong>?
              {deleteTarget?.type === "menu" && " Todos os submenus filhos serão removidos."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!deleteTarget) return;
                deleteTarget.type === "menu"
                  ? deleteMenu.mutate(deleteTarget.id)
                  : deleteSubmenu.mutate(deleteTarget.id);
              }}
              disabled={deleteMenu.isPending || deleteSubmenu.isPending}
            >Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function SortableMenuRow({
  menu, subs, sensors, expanded, onToggle, onEdit, onDelete, onAddSub, onEditSub, onDeleteSub, onSubDrag,
}: {
  menu: MenuItem;
  subs: SubmenuItem[];
  sensors: ReturnType<typeof useSensors>;
  expanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onAddSub: (parent: string | null) => void;
  onEditSub: (s: SubmenuItem) => void;
  onDeleteSub: (s: SubmenuItem) => void;
  onSubDrag: (menuId: string, list: SubmenuItem[]) => (e: DragEndEvent) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: menu.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  const Icon = getIconComponent(menu.icon);
  const rootSubs = subs.filter((s) => !s.parent_submenu_id);

  return (
    <div ref={setNodeRef} style={style} className="rounded-lg border bg-card">
      <div className="flex items-center gap-2 p-3">
        <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing touch-none p-1 hover:bg-muted rounded">
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </button>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onToggle}>
          <ChevronRight className={`h-4 w-4 transition-transform ${expanded ? "rotate-90" : ""}`} />
        </Button>
        <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center">
          <Icon className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm truncate">{menu.name}</span>
            {!menu.is_active && <Badge variant="outline" className="text-[10px]">Inativo</Badge>}
            <Badge variant="secondary" className="text-[10px]">{menu.module}</Badge>
            {menu.required_permission && (
              <Badge className="text-[10px] font-mono">{menu.required_permission}</Badge>
            )}
          </div>
          {menu.path && <span className="text-xs text-muted-foreground font-mono">{menu.path}</span>}
        </div>
        <Badge variant="outline" className="text-xs"><FolderTree className="h-3 w-3 mr-1" />{subs.length}</Badge>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onAddSub(null)} title="Adicionar submenu">
          <Plus className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onEdit} title="Editar">
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={onDelete} title="Excluir">
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
      {expanded && (
        <div className="border-t bg-muted/20 p-2">
          {rootSubs.length === 0 ? (
            <div className="text-center py-4 text-xs text-muted-foreground">
              Nenhum submenu. <button className="text-primary hover:underline" onClick={() => onAddSub(null)}>Adicionar</button>
            </div>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onSubDrag(menu.id, rootSubs)}>
              <SortableContext items={rootSubs.map((s) => s.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-1">
                  {rootSubs.map((s) => (
                    <SortableSubRow
                      key={s.id} sub={s} allSubs={subs} depth={0}
                      onEdit={onEditSub} onDelete={onDeleteSub} onAddChild={(pid) => onAddSub(pid)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </div>
      )}
    </div>
  );
}

function SortableSubRow({
  sub, allSubs, depth, onEdit, onDelete, onAddChild,
}: {
  sub: SubmenuItem;
  allSubs: SubmenuItem[];
  depth: number;
  onEdit: (s: SubmenuItem) => void;
  onDelete: (s: SubmenuItem) => void;
  onAddChild: (parentId: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: sub.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1, marginLeft: depth * 16 };
  const Icon = getIconComponent(sub.icon);
  const children = allSubs.filter((c) => c.parent_submenu_id === sub.id);

  return (
    <div>
      <div ref={setNodeRef} style={style} className="flex items-center gap-2 p-2 rounded bg-card hover:bg-muted/40">
        <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing touch-none p-0.5">
          <GripVertical className="h-3 w-3 text-muted-foreground" />
        </button>
        <Icon className="h-3.5 w-3.5 text-primary" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-sm">{sub.name}</span>
            {!sub.is_active && <Badge variant="outline" className="text-[10px]">Inativo</Badge>}
            {sub.required_permission && (
              <Badge className="text-[10px] font-mono">{sub.required_permission}</Badge>
            )}
          </div>
          <span className="text-xs text-muted-foreground font-mono truncate">{sub.path}</span>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onAddChild(sub.id)} title="Adicionar filho">
          <Plus className="h-3 w-3" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(sub)} title="Editar">
          <Pencil className="h-3 w-3" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => onDelete(sub)} title="Excluir">
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
      {children.map((c) => (
        <SortableSubRow key={c.id} sub={c} allSubs={allSubs} depth={depth + 1}
          onEdit={onEdit} onDelete={onDelete} onAddChild={onAddChild} />
      ))}
    </div>
  );
}