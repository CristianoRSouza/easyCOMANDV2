"use client";

/**
 * Admin do catálogo de pacotes de crédito do PlugSign
 * (billing.module_plans, module='plugsign').
 * features = { credits: number, description: string, is_popular: boolean, kind: 'credit_pack' }
 * Pagamento único — usa price_brl como preço total do pacote.
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
import { Save, RotateCcw, Database, Pencil, Coins, Sparkles, FileSignature } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/shared/ui/dialog";
import { useToast } from "@/shared/hooks/use-toast";
import {
  describeBillingError, fetchModulePlansAdmin, updateModulePlan,
  type ModulePlanAdminRow, type ModulePlanPatch,
} from "@/modules/billing/infrastructure/queries";

interface PackFeatures {
  credits: number;
  description: string;
  is_popular: boolean;
  kind: "credit_pack";
}

function normalizeFeatures(raw: unknown): PackFeatures {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    credits: Number.isFinite(Number(r.credits)) ? Math.max(0, Math.floor(Number(r.credits))) : 0,
    description: typeof r.description === "string" ? r.description : "",
    is_popular: Boolean(r.is_popular),
    kind: "credit_pack",
  };
}

const brl = (v: unknown) =>
  typeof v === "number"
    ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v)
    : "—";

const perDoc = (price: number, credits: number) =>
  credits > 0 ? brl(price / credits) : "—";

function BrlInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [focused, setFocused] = useState(false);
  const [raw, setRaw] = useState<string>(String(value ?? 0));
  useEffect(() => { if (!focused) setRaw(String(value ?? 0)); }, [value, focused]);
  return (
    <Input
      inputMode="decimal"
      value={focused ? raw : brl(Number(value) || 0)}
      onFocus={() => { setRaw(String(value ?? 0)); setFocused(true); }}
      onChange={(e) => {
        const s = e.target.value.replace(/[^\d.,-]/g, "").replace(",", ".");
        setRaw(s);
        const n = Number(s);
        if (Number.isFinite(n)) onChange(Math.max(0, n));
      }}
      onBlur={() => setFocused(false)}
      className="h-9 text-sm tabular-nums text-right"
    />
  );
}

interface Draft {
  name?: string;
  tier?: string | null;
  sort_order?: number;
  price_brl?: number;
  is_active?: boolean;
  coming_soon?: boolean;
  features?: PackFeatures;
}

export function PlugSignPacksAdminTab() {
  const { toast } = useToast();
  const [rows, setRows] = useState<ModulePlanAdminRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await fetchModulePlansAdmin("plugsign");
      setRows(data);
      setDrafts({});
    } catch (e) {
      toast({ title: "Erro ao carregar pacotes", description: describeBillingError(e), variant: "destructive" });
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
    if (draft.is_active !== undefined) patch.is_active = draft.is_active;
    if (draft.coming_soon !== undefined) patch.coming_soon = draft.coming_soon;
    if (draft.features !== undefined) patch.features = draft.features;

    setSavingId(row.id);
    try {
      await updateModulePlan(row.id, patch);
      toast({ title: "Pacote atualizado", description: `${row.name} (${row.slug}) salvo.` });
      setEditingId(null);
      await load();
    } catch (e) {
      toast({ title: "Falha ao salvar pacote", description: describeBillingError(e), variant: "destructive" });
    } finally {
      setSavingId(null);
    }
  };

  if (loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-64 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">
          Nenhum pacote cadastrado para <code>module=plugsign</code> em <code>billing.module_plans</code>.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-xs">
        <Database className="h-4 w-4 text-primary mt-0.5 shrink-0" />
        <div>
          <p className="font-medium text-foreground">Pacotes de crédito PlugSign · edição direta no banco</p>
          <p className="text-muted-foreground">
            Alterações vão para <code>billing.module_plans</code> (module=plugsign) e refletem imediatamente no catálogo público do PlugSign dentro do EasyArchive.
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {rows.map((row) => {
          const isDirty = dirtyMap[row.id];
          const isInactive = !row.is_active;
          const features = normalizeFeatures(row.features);
          const isHighlight = features.is_popular;
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
              {isHighlight && (
                <span className="absolute top-3 right-3 inline-flex items-center gap-1 rounded-md bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">
                  <Sparkles className="h-3 w-3" /> POPULAR
                </span>
              )}

              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="space-y-1.5 min-w-0">
                  <div className="flex items-center gap-2">
                    <FileSignature className="h-4 w-4 text-primary/80 shrink-0" />
                    <h3 className="font-bold text-foreground truncate">{row.name}</h3>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <Badge variant="outline" className="text-[10px] font-mono">{row.slug}</Badge>
                    {row.coming_soon && (
                      <Badge className="text-[10px] bg-amber-500/15 text-amber-600 border-amber-500/30">Em breve</Badge>
                    )}
                    {isInactive && (
                      <Badge variant="outline" className="text-[10px] text-muted-foreground">Inativo</Badge>
                    )}
                  </div>
                  {features.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2">{features.description}</p>
                  )}
                </div>
                {isDirty && (
                  <span className="text-[10px] text-primary font-medium shrink-0">pendente</span>
                )}
              </div>

              <div className="mt-auto space-y-3 pt-4 border-t border-border/50">
                <div className="flex items-baseline justify-between">
                  <span className="text-2xl font-bold text-foreground tabular-nums">
                    {brl(Number(row.price_brl))}
                  </span>
                  <span className="text-[10px] text-muted-foreground">pagamento único</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <Coins className="h-3.5 w-3.5 text-primary/70" />
                  <span className="font-semibold text-foreground">{features.credits.toLocaleString("pt-BR")}</span>
                  <span className="text-muted-foreground">créditos · documentos</span>
                </div>
                <div className="flex items-center justify-between rounded-md border border-border/60 bg-background/50 px-2.5 py-1.5">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Custo por doc</span>
                  <span className="text-sm font-bold text-primary tabular-nums">
                    {perDoc(Number(row.price_brl), features.credits)}
                  </span>
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
        const currentPrice = draft.price_brl ?? Number(row.price_brl);
        const setFeature = <K extends keyof PackFeatures>(k: K, v: PackFeatures[K]) =>
          setField(row.id, "features", { ...features, [k]: v });
        return (
          <Dialog key={row.id} open onOpenChange={(o) => !o && setEditingId(null)}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-card">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 flex-wrap">
                  <FileSignature className="h-4 w-4 text-primary" />
                  <span>{row.name}</span>
                  <Badge variant="outline" className="text-[10px] font-mono">{row.slug}</Badge>
                  {features.is_popular && <Badge className="text-[10px] bg-primary text-primary-foreground">Popular</Badge>}
                  {isDirty && <Badge className="text-[10px] bg-primary/15 text-primary border-primary/30">alterações pendentes</Badge>}
                </DialogTitle>
                <DialogDescription className="text-xs">
                  Edição direta de <code>billing.module_plans</code>. Última alteração: {new Date(row.updated_at).toLocaleString("pt-BR")}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 pt-2">
                <div className="grid gap-3 sm:grid-cols-2 rounded-lg border border-border bg-background/60 p-4 shadow-md">
                  <div className="space-y-1">
                    <Label className="text-xs">Nome do pacote</Label>
                    <Input value={draft.name ?? row.name}
                      onChange={(e) => setField(row.id, "name", e.target.value)}
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
                    <Label className="text-xs">Preço total (R$)</Label>
                    <BrlInput
                      value={currentPrice}
                      onChange={(v) => setField(row.id, "price_brl", v)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs flex items-center justify-between gap-2">
                      <span>Créditos no pacote</span>
                      <span className="text-[10px] font-normal text-muted-foreground">1 crédito = 1 doc</span>
                    </Label>
                    <Input type="number" inputMode="numeric"
                      value={String(features.credits)}
                      onChange={(e) => setFeature("credits", Math.max(0, Math.floor(Number(e.target.value) || 0)))}
                      className="h-9 text-sm tabular-nums text-right" />
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <Label className="text-xs">Descrição curta</Label>
                    <Textarea value={features.description}
                      onChange={(e) => setFeature("description", e.target.value)}
                      rows={2}
                      placeholder="Ex.: Ideal para autônomos"
                      className="text-sm" />
                  </div>
                  <div className="sm:col-span-2 flex items-center justify-between rounded-md border border-dashed border-primary/30 bg-primary/5 px-3 py-2">
                    <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                      Custo por documento (calculado)
                    </span>
                    <span className="text-base font-bold text-primary tabular-nums">
                      {perDoc(currentPrice, features.credits)}
                    </span>
                  </div>
                </div>

                <div className="rounded-lg border border-border bg-background/60 p-4 shadow-md">
                  <h4 className="text-xs font-bold uppercase tracking-widest text-foreground mb-3">Status do pacote</h4>
                  <div className="grid gap-2 sm:grid-cols-3">
                    <label className="flex items-start gap-2 rounded-md border border-border bg-card px-2.5 py-2 cursor-pointer hover:bg-muted/40 transition-colors">
                      <Switch checked={draft.is_active ?? row.is_active}
                        onCheckedChange={(c) => setField(row.id, "is_active", c)} />
                      <div>
                        <div className="text-xs font-medium">Ativo</div>
                        <div className="text-[10px] text-muted-foreground">Aparece no catálogo público</div>
                      </div>
                    </label>
                    <label className="flex items-start gap-2 rounded-md border border-border bg-card px-2.5 py-2 cursor-pointer hover:bg-muted/40 transition-colors">
                      <Switch checked={draft.coming_soon ?? row.coming_soon}
                        onCheckedChange={(c) => setField(row.id, "coming_soon", c)} />
                      <div>
                        <div className="text-xs font-medium">Em breve</div>
                        <div className="text-[10px] text-muted-foreground">Indisponível para compra</div>
                      </div>
                    </label>
                    <label className="flex items-start gap-2 rounded-md border border-border bg-card px-2.5 py-2 cursor-pointer hover:bg-muted/40 transition-colors">
                      <Switch checked={features.is_popular}
                        onCheckedChange={(c) => setFeature("is_popular", c)} />
                      <div>
                        <div className="text-xs font-medium">Mais popular</div>
                        <div className="text-[10px] text-muted-foreground">Destaque visual no card</div>
                      </div>
                    </label>
                  </div>
                </div>
              </div>

              <DialogFooter className="gap-2">
                <Button type="button" size="sm" variant="outline"
                  disabled={!isDirty || savingId === row.id} onClick={() => resetRow(row.id)}>
                  <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Descartar
                </Button>
                <Button type="button" size="sm"
                  disabled={!isDirty || savingId === row.id} onClick={() => void saveRow(row)}>
                  <Save className="h-3.5 w-3.5 mr-1.5" /> {savingId === row.id ? "Salvando…" : "Salvar pacote"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        );
      })}
    </div>
  );
}