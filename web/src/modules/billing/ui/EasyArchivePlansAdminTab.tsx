"use client";

/**
 * Admin do catálogo de planos do EasyArchive (billing.module_plans, module='archive').
 * Schema diferente do EasyFoodPay: assinatura simples por usuário/mês, com
 * features = { max_documents, max_storage_mb, support, contact_sales, list[] }
 * volume_discounts = [{ min_users, max_users, discount_pct }]
 */
import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/shared/ui/card";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Switch } from "@/shared/ui/switch";
import { Badge } from "@/shared/ui/badge";
import { Skeleton } from "@/shared/ui/skeleton";
import { Textarea } from "@/shared/ui/textarea";
import { Save, RotateCcw, Database, Pencil, FileText, HardDrive, Users } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { useToast } from "@/shared/hooks/use-toast";
import {
  describeBillingError, fetchModulePlansAdmin, updateModulePlan,
  type ModulePlanAdminRow, type ModulePlanPatch,
} from "@/modules/billing/infrastructure/queries";

interface ArchiveFeatures {
  max_documents: number;     // -1 = ilimitado
  max_storage_mb: number;    // -1 = ilimitado
  support: "none" | "business_hours" | "sla";
  contact_sales: boolean;
  list: string[];
}

const SUPPORT_LABEL: Record<ArchiveFeatures["support"], string> = {
  none: "Sem suporte",
  business_hours: "Horário comercial",
  sla: "SLA dedicado",
};

function normalizeFeatures(raw: unknown): ArchiveFeatures {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const list = Array.isArray(r.list) ? r.list.map((x) => String(x)) : [];
  const support = (r.support === "sla" || r.support === "business_hours" || r.support === "none")
    ? r.support
    : "none";
  return {
    max_documents: Number.isFinite(Number(r.max_documents)) ? Number(r.max_documents) : 0,
    max_storage_mb: Number.isFinite(Number(r.max_storage_mb)) ? Number(r.max_storage_mb) : 0,
    support,
    contact_sales: Boolean(r.contact_sales),
    list,
  };
}

const brl = (v: unknown) =>
  typeof v === "number"
    ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v)
    : "—";

const fmtDocs = (n: number) =>
  n < 0 ? "Ilimitado" : new Intl.NumberFormat("pt-BR").format(n);

const fmtStorage = (mb: number) => {
  if (mb < 0) return "Ilimitado";
  if (mb >= 1024) return `${(mb / 1024).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} GB`;
  return `${mb} MB`;
};

interface Draft {
  name?: string;
  tier?: string | null;
  sort_order?: number;
  price_brl?: number;
  additional_user_price_brl?: number;
  max_users?: number;
  is_active?: boolean;
  coming_soon?: boolean;
  features?: ArchiveFeatures;
}

export function EasyArchivePlansAdminTab() {
  const { toast } = useToast();
  const [rows, setRows] = useState<ModulePlanAdminRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await fetchModulePlansAdmin("archive");
      setRows(data);
      setDrafts({});
    } catch (e) {
      toast({ title: "Erro ao carregar planos", description: describeBillingError(e), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); /* eslint-disable-next-line */ }, []);

  const dirtyMap = useMemo(() => {
    const m: Record<string, boolean> = {};
    for (const [id, d] of Object.entries(drafts)) m[id] = Object.keys(d).length > 0;
    return m;
  }, [drafts]);

  const setField = <K extends keyof Draft>(rowId: string, key: K, value: Draft[K]) => {
    setDrafts((prev) => ({ ...prev, [rowId]: { ...(prev[rowId] ?? {}), [key]: value } }));
  };

  const resetRow = (rowId: string) => {
    setDrafts((prev) => { const next = { ...prev }; delete next[rowId]; return next; });
  };

  const saveRow = async (row: ModulePlanAdminRow) => {
    const draft = drafts[row.id];
    if (!draft || Object.keys(draft).length === 0) return;
    const patch: ModulePlanPatch = {};
    if (draft.name !== undefined) patch.name = draft.name;
    if (draft.tier !== undefined) patch.tier = draft.tier;
    if (draft.sort_order !== undefined) patch.sort_order = draft.sort_order;
    if (draft.price_brl !== undefined) patch.price_brl = draft.price_brl;
    if (draft.additional_user_price_brl !== undefined) patch.additional_user_price_brl = draft.additional_user_price_brl;
    if (draft.max_users !== undefined) patch.max_users = draft.max_users;
    if (draft.is_active !== undefined) patch.is_active = draft.is_active;
    if (draft.coming_soon !== undefined) patch.coming_soon = draft.coming_soon;
    if (draft.features !== undefined) patch.features = draft.features;

    setSavingId(row.id);
    try {
      await updateModulePlan(row.id, patch);
      toast({ title: "Plano atualizado", description: `${row.name} (${row.slug}) salvo.` });
      setEditingId(null);
      await load();
    } catch (e) {
      toast({ title: "Falha ao salvar plano", description: describeBillingError(e), variant: "destructive" });
    } finally {
      setSavingId(null);
    }
  };

  if (loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-72 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">
          Nenhum plano cadastrado para <code>module=archive</code> em <code>billing.module_plans</code>.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-xs">
        <Database className="h-4 w-4 text-primary mt-0.5 shrink-0" />
        <div>
          <p className="font-medium text-foreground">Catálogo EasyArchive · edição direta no banco</p>
          <p className="text-muted-foreground">
            Alterações vão para <code>billing.module_plans</code> (module=archive) e refletem imediatamente na página pública de planos do EasyArchive.
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {rows.map((row) => {
          const isDirty = dirtyMap[row.id];
          const isInactive = !row.is_active;
          const isHighlight = (row.tier ?? "").toLowerCase() === "pro";
          const features = normalizeFeatures(row.features);
          return (
            <button
              type="button"
              key={row.id}
              onClick={() => setEditingId(row.id)}
              className={[
                "group relative flex flex-col rounded-xl border p-5 text-left transition-all",
                isInactive
                  ? "border-dashed border-border/60 bg-muted/10 opacity-70 hover:opacity-100"
                  : isHighlight
                  ? "border-primary/40 bg-primary/5 ring-1 ring-primary/10 hover:border-primary/60"
                  : "border-border bg-card hover:border-primary/40",
                isDirty ? "border-primary/70 ring-1 ring-primary/20" : "",
              ].join(" ")}
            >
              <div className="flex items-start justify-between gap-2 mb-4">
                <div className="space-y-1.5 min-w-0">
                  <h3 className="font-bold text-foreground truncate">{row.name}</h3>
                  <div className="flex flex-wrap gap-1">
                    <Badge variant="outline" className="text-[10px] font-mono">{row.slug}</Badge>
                    {row.tier && <Badge variant="secondary" className="text-[10px]">{row.tier}</Badge>}
                    {row.coming_soon && (
                      <Badge className="text-[10px] bg-amber-500/15 text-amber-600 border-amber-500/30">Em breve</Badge>
                    )}
                    {isInactive && (
                      <Badge variant="outline" className="text-[10px] text-muted-foreground">Inativo</Badge>
                    )}
                    {features.contact_sales && (
                      <Badge className="text-[10px] bg-primary/15 text-primary border-primary/30">Contato comercial</Badge>
                    )}
                  </div>
                </div>
                {isDirty && (
                  <span className="text-[10px] text-primary font-medium shrink-0">pendente</span>
                )}
              </div>

              <div className="mt-auto space-y-3 pt-4 border-t border-border/50">
                <div className="space-y-1">
                  <div className="flex items-baseline justify-between">
                    <span className="text-xs text-muted-foreground">1º usuário · mês</span>
                    <span className="text-lg font-bold text-foreground tabular-nums">
                      {Number(row.price_brl) === 0 ? "Grátis" : brl(row.price_brl)}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span className="text-[11px] text-muted-foreground">Usuário adicional</span>
                    <span className="text-xs font-semibold text-muted-foreground tabular-nums">
                      {Number(row.additional_user_price_brl) === 0 ? "—" : `+ ${brl(row.additional_user_price_brl)}`}
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-1.5 text-xs">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <FileText className="h-3.5 w-3.5 text-primary/70" />
                    <span>{fmtDocs(features.max_documents)} documentos</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <HardDrive className="h-3.5 w-3.5 text-primary/70" />
                    <span>{fmtStorage(features.max_storage_mb)} de armazenamento</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Users className="h-3.5 w-3.5 text-primary/70" />
                    <span>
                      {row.max_users >= 9999 ? "Usuários ilimitados" : `Até ${row.max_users} usuário${row.max_users === 1 ? "" : "s"}`}
                    </span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1 pt-1">
                  <Badge variant="outline" className="text-[10px]">{SUPPORT_LABEL[features.support]}</Badge>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-border/40 flex items-center justify-between text-[10px] text-muted-foreground">
                <span className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 text-primary">
                  <Pencil className="h-3 w-3" /> editar
                </span>
                <span>ordem #{row.sort_order}</span>
              </div>
            </button>
          );
        })}
      </div>

      {rows.map((row) => {
        if (editingId !== row.id) return null;
        const draft = drafts[row.id] ?? {};
        const features = draft.features ?? normalizeFeatures(row.features);
        const isDirty = dirtyMap[row.id];
        const setFeature = <K extends keyof ArchiveFeatures>(k: K, v: ArchiveFeatures[K]) =>
          setField(row.id, "features", { ...features, [k]: v });
        return (
          <Dialog key={row.id} open onOpenChange={(o) => !o && setEditingId(null)}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-card">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 flex-wrap">
                  <span>{row.name}</span>
                  <Badge variant="outline" className="text-[10px] font-mono">{row.slug}</Badge>
                  {row.tier && <Badge variant="secondary" className="text-[10px]">{row.tier}</Badge>}
                  {isDirty && <Badge className="text-[10px] bg-primary/15 text-primary border-primary/30">alterações pendentes</Badge>}
                </DialogTitle>
                <DialogDescription className="text-xs">
                  Edição direta de <code>billing.module_plans</code>. Última alteração: {new Date(row.updated_at).toLocaleString("pt-BR")}
                </DialogDescription>
              </DialogHeader>

              <Tabs defaultValue="basico" className="mt-2">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="basico">Básico</TabsTrigger>
                  <TabsTrigger value="limites">Limites</TabsTrigger>
                  <TabsTrigger value="features">Lista de recursos</TabsTrigger>
                </TabsList>

                <TabsContent value="basico" className="space-y-4 pt-4">
                  <div className="grid gap-3 sm:grid-cols-2 rounded-lg border border-border bg-background/60 p-4 shadow-md">
                    <div className="space-y-1">
                      <Label className="text-xs">Nome do plano</Label>
                      <Input value={draft.name ?? row.name}
                        onChange={(e) => setField(row.id, "name", e.target.value)}
                        className="h-9 text-sm" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Tier</Label>
                      <Input value={draft.tier ?? row.tier ?? ""}
                        onChange={(e) => setField(row.id, "tier", e.target.value || null)}
                        placeholder="free / starter / pro / business / enterprise"
                        className="h-9 text-sm" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Ordem no catálogo</Label>
                      <Input type="number" inputMode="numeric"
                        value={String(draft.sort_order ?? row.sort_order)}
                        onChange={(e) => setField(row.id, "sort_order", Math.max(0, Number(e.target.value) || 0))}
                        className="h-9 text-sm tabular-nums" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs flex items-center justify-between gap-2">
                        <span>1º usuário · mês (R$)</span>
                        <span className="text-[10px] font-normal text-muted-foreground">0 = grátis</span>
                      </Label>
                      <Input type="number" inputMode="decimal" step="0.01"
                        value={String(draft.price_brl ?? row.price_brl ?? 0)}
                        onChange={(e) => setField(row.id, "price_brl", Math.max(0, Number(e.target.value) || 0))}
                        className="h-9 text-sm tabular-nums text-right" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs flex items-center justify-between gap-2">
                        <span>Usuário adicional · mês (R$)</span>
                        <span className="text-[10px] font-normal text-muted-foreground">cada usuário extra</span>
                      </Label>
                      <Input type="number" inputMode="decimal" step="0.01"
                        value={String(draft.additional_user_price_brl ?? row.additional_user_price_brl ?? 0)}
                        onChange={(e) => setField(row.id, "additional_user_price_brl", Math.max(0, Number(e.target.value) || 0))}
                        className="h-9 text-sm tabular-nums text-right" />
                    </div>
                  </div>

                  <div className="rounded-lg border border-border bg-background/60 p-4 shadow-md">
                    <h4 className="text-xs font-bold uppercase tracking-widest text-foreground mb-3">Status do plano</h4>
                    <div className="grid gap-2 sm:grid-cols-3">
                      <label className="flex items-start gap-2 rounded-md border border-border bg-card px-2.5 py-2 cursor-pointer hover:bg-muted/40 transition-colors">
                        <Switch checked={draft.is_active ?? row.is_active}
                          onCheckedChange={(c) => setField(row.id, "is_active", c)} />
                        <div><div className="text-xs font-medium">Ativo</div>
                          <div className="text-[10px] text-muted-foreground">Aparece no catálogo público</div></div>
                      </label>
                      <label className="flex items-start gap-2 rounded-md border border-border bg-card px-2.5 py-2 cursor-pointer hover:bg-muted/40 transition-colors">
                        <Switch checked={draft.coming_soon ?? row.coming_soon}
                          onCheckedChange={(c) => setField(row.id, "coming_soon", c)} />
                        <div><div className="text-xs font-medium">Em breve</div>
                          <div className="text-[10px] text-muted-foreground">Indisponível para contratação</div></div>
                      </label>
                      <label className="flex items-start gap-2 rounded-md border border-border bg-card px-2.5 py-2 cursor-pointer hover:bg-muted/40 transition-colors">
                        <Switch checked={features.contact_sales}
                          onCheckedChange={(c) => setFeature("contact_sales", c)} />
                        <div><div className="text-xs font-medium">Contato comercial</div>
                          <div className="text-[10px] text-muted-foreground">Substitui CTA por "Falar com vendas"</div></div>
                      </label>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="limites" className="space-y-4 pt-4">
                  <div className="grid gap-3 sm:grid-cols-2 rounded-lg border border-border bg-background/60 p-4 shadow-md">
                    <div className="space-y-1">
                      <Label className="text-xs flex items-center justify-between gap-2">
                        <span>Máx. documentos</span>
                        <span className="text-[10px] font-normal text-muted-foreground">-1 = ilimitado</span>
                      </Label>
                      <Input type="number" inputMode="numeric"
                        value={String(features.max_documents)}
                        onChange={(e) => setFeature("max_documents", Math.floor(Number(e.target.value) || 0))}
                        className="h-9 text-sm tabular-nums text-right" />
                      <p className="text-[10px] text-muted-foreground">
                        Atual: <strong>{fmtDocs(features.max_documents)}</strong>
                      </p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs flex items-center justify-between gap-2">
                        <span>Armazenamento (MB)</span>
                        <span className="text-[10px] font-normal text-muted-foreground">-1 = ilimitado</span>
                      </Label>
                      <Input type="number" inputMode="numeric"
                        value={String(features.max_storage_mb)}
                        onChange={(e) => setFeature("max_storage_mb", Math.floor(Number(e.target.value) || 0))}
                        className="h-9 text-sm tabular-nums text-right" />
                      <p className="text-[10px] text-muted-foreground">
                        Atual: <strong>{fmtStorage(features.max_storage_mb)}</strong>
                      </p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs flex items-center justify-between gap-2">
                        <span>Máx. usuários</span>
                        <span className="text-[10px] font-normal text-muted-foreground">9999 = ilimitado</span>
                      </Label>
                      <Input type="number" inputMode="numeric"
                        value={String(draft.max_users ?? row.max_users)}
                        onChange={(e) => setField(row.id, "max_users", Math.max(1, Math.floor(Number(e.target.value) || 1)))}
                        className="h-9 text-sm tabular-nums text-right" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Suporte</Label>
                      <Select value={features.support} onValueChange={(v) => setFeature("support", v as ArchiveFeatures["support"])}>
                        <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Sem suporte</SelectItem>
                          <SelectItem value="business_hours">Horário comercial</SelectItem>
                          <SelectItem value="sla">SLA dedicado</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="features" className="pt-4">
                  <div className="rounded-lg border border-border bg-background/60 p-4 shadow-md space-y-2">
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-widest text-foreground">Lista de recursos do card</h4>
                      <p className="text-[11px] text-muted-foreground">
                        Um item por linha — exibido com check verde no card público de planos.
                      </p>
                    </div>
                    <Textarea
                      value={features.list.join("\n")}
                      onChange={(e) => setFeature("list", e.target.value.split("\n").map((s) => s.trimEnd()).filter((s, i, arr) => s.length > 0 || i < arr.length - 1))}
                      rows={Math.max(8, features.list.length + 2)}
                      className="text-sm font-mono"
                      placeholder={"500 documentos\n5 GB de armazenamento\n1 usuário\nUpload com OCR"}
                    />
                    <div className="flex flex-wrap gap-1 pt-1">
                      {features.list.filter(Boolean).map((it, i) => (
                        <Badge key={i} variant="secondary" className="text-[10px]">{it}</Badge>
                      ))}
                    </div>
                  </div>
                </TabsContent>

              </Tabs>

              <DialogFooter className="gap-2">
                <Button type="button" size="sm" variant="outline"
                  disabled={!isDirty || savingId === row.id} onClick={() => resetRow(row.id)}>
                  <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Descartar
                </Button>
                <Button type="button" size="sm"
                  disabled={!isDirty || savingId === row.id} onClick={() => void saveRow(row)}>
                  <Save className="h-3.5 w-3.5 mr-1.5" /> {savingId === row.id ? "Salvando…" : "Salvar plano"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        );
      })}
    </div>
  );
}
