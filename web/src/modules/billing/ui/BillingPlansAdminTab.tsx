"use client";

/**
 * Edição direta de billing.module_plans (catálogo).
 * RLS: somente system_admin pode gravar.
 */
import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/shared/ui/card";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Switch } from "@/shared/ui/switch";
import { Badge } from "@/shared/ui/badge";
import { Skeleton } from "@/shared/ui/skeleton";
import { Save, RotateCcw, Database, Plus, Trash2, TrendingDown, Pencil } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs";
import { useToast } from "@/shared/hooks/use-toast";
import {
  describeBillingError, fetchModulePlansAdmin, updateModulePlan,
  type ModulePlanAdminRow, type ModulePlanPatch,
} from "@/modules/billing/infrastructure/queries";
import { normalizeVolumeDiscounts, type VolumeDiscountTier } from "@/modules/billing/domain/volume-discount";

type DraftValue = string | number | boolean | null | VolumeDiscountTier[];
type Draft = Partial<Record<keyof ModulePlanPatch, DraftValue>>;

interface FieldDef {
  key: keyof ModulePlanPatch;
  label: string;
  type: "currency" | "number" | "percent" | "integer" | "text" | "boolean";
  hint?: string;
  readOnly?: boolean;
}

const FIELDS: FieldDef[] = [
  { key: "name", label: "Nome do plano", type: "text" },
  { key: "tier", label: "Tier", type: "text", hint: "demo / standard / pro / enterprise" },
  { key: "sort_order", label: "Ordem", type: "integer" },
  { key: "price_brl", label: "Preço/mês (1 dispositivo) · calculado", type: "currency", hint: "= Sistema base + TEF base", readOnly: true },
  { key: "base_software_brl", label: "Sistema · base 1º disp.", type: "currency" },
  { key: "additional_software_brl", label: "Sistema · adicional/disp.", type: "currency" },
  { key: "base_tef_brl", label: "TEF · base 1º disp.", type: "currency" },
  { key: "additional_tef_brl", label: "TEF · adicional/disp.", type: "currency" },
  { key: "history_window_days", label: "Janela histórico (dias)", type: "integer", hint: "Vazio = ilimitado" },
  { key: "pix_fee_pct", label: "Taxa PIX (%)", type: "percent", hint: "Ex.: 0,89 = 0,89%" },
  { key: "max_users", label: "Máx. usuários", type: "integer" },
];

const FLAGS: { key: keyof ModulePlanPatch; label: string; hint?: string }[] = [
  { key: "is_active", label: "Ativo", hint: "Aparece no catálogo público" },
  { key: "coming_soon", label: "Em breve", hint: "Indisponível para contratação" },
  { key: "is_mock", label: "Modo simulação", hint: "Não cobra valores reais" },
];

interface SubGroup {
  title: string;
  description?: string;
  keys: (keyof ModulePlanPatch)[];
  highlight?: boolean;
}

const FIELD_LAYOUT: Record<string, SubGroup[]> = {
  identificacao: [
    {
      title: "Dados do plano",
      description: "Nome, tier comercial e ordenação no catálogo público.",
      keys: ["name", "tier", "sort_order"],
    },
  ],
  precos: [
    {
      title: "Preço total calculado",
      description: "Soma automática de Sistema base + TEF base. Não editável.",
      keys: ["price_brl"],
      highlight: true,
    },
    {
      title: "Sistema (software)",
      description: "Mensalidade do software por dispositivo.",
      keys: ["base_software_brl", "additional_software_brl"],
    },
    {
      title: "TEF",
      description: "Mensalidade do TEF por dispositivo.",
      keys: ["base_tef_brl", "additional_tef_brl"],
    },
    {
      title: "Taxas variáveis",
      description: "Cobranças incidentes sobre transações.",
      keys: ["pix_fee_pct"],
    },
  ],
  limites: [
    {
      title: "Limites de uso",
      description: "Restrições aplicadas às empresas neste plano.",
      keys: ["history_window_days", "max_users"],
    },
  ],
};

function fieldByKey(key: keyof ModulePlanPatch): FieldDef | undefined {
  return FIELDS.find((f) => f.key === key);
}

const brl = (v: unknown) =>
  typeof v === "number"
    ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v)
    : "—";

function parseValue(field: FieldDef, raw: string): unknown {
  if (raw === "" || raw === null || raw === undefined) {
    return field.type === "text" ? "" : null;
  }
  if (field.type === "text") return raw;
  const normalized = raw.replace(/\./g, "").replace(",", ".");
  if (/^-?\d*[.,]?\d*$/.test(raw) && /[.,]$/.test(raw)) return raw;
  const num = Number(normalized);
  if (!Number.isFinite(num)) return NaN;
  if (field.type === "percent") return num / 100;
  return num;
}

function rawFromValue(field: FieldDef, value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number") {
    if (field.type === "percent") {
      const pct = value * 100;
      return String(Number(pct.toFixed(4))).replace(".", ",");
    }
    if (field.type === "currency") {
      return new Intl.NumberFormat("pt-BR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(value);
    }
    return String(value).replace(".", ",");
  }
  return String(value);
}

export function BillingPlansAdminTab({ module = "easycommandpay-totem" }: { module?: string }) {
  const { toast } = useToast();
  const [rows, setRows] = useState<ModulePlanAdminRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await fetchModulePlansAdmin(module);
      setRows(data);
      setDrafts({});
    } catch (e) {
      toast({ title: "Erro ao carregar planos", description: describeBillingError(e), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); /* eslint-disable-next-line */ }, [module]);

  const dirtyMap = useMemo(() => {
    const m: Record<string, boolean> = {};
    for (const [id, d] of Object.entries(drafts)) m[id] = Object.keys(d).length > 0;
    return m;
  }, [drafts]);

  const setField = (rowId: string, key: keyof ModulePlanPatch, value: unknown) => {
    setDrafts((prev) => {
      const cur = { ...(prev[rowId] ?? {}) };
      cur[key] = value as never;
      return { ...prev, [rowId]: cur };
    });
  };

  const resetRow = (rowId: string) => {
    setDrafts((prev) => { const next = { ...prev }; delete next[rowId]; return next; });
  };

  const saveRow = async (row: ModulePlanAdminRow) => {
    const draft = drafts[row.id];
    if (!draft || Object.keys(draft).length === 0) return;
    // Plano de assinatura simples (sem composição Sistema+TEF) → price_brl é editável direto.
    const isSubscriptionMode =
      Number(row.base_software_brl ?? 0) === 0 &&
      Number(row.base_tef_brl ?? 0) === 0 &&
      Number(draft.base_software_brl ?? row.base_software_brl ?? 0) === 0 &&
      Number(draft.base_tef_brl ?? row.base_tef_brl ?? 0) === 0;
    const patch: ModulePlanPatch = {};
    for (const [k, v] of Object.entries(draft)) {
      if (k === "price_brl" && !isSubscriptionMode) continue;
      const fdef = FIELDS.find((x) => x.key === (k as keyof ModulePlanPatch));
      let value: unknown = v;
      if (typeof v === "string" && fdef && fdef.type !== "text") {
        const cleaned = v.replace(/[.,]$/, "").replace(",", ".");
        if (cleaned === "" || cleaned === "-") value = null;
        else {
          const n = Number(cleaned);
          if (!Number.isFinite(n)) {
            toast({ title: "Valor inválido", description: `Campo "${k}" não é um número válido.`, variant: "destructive" });
            return;
          }
          value = fdef.type === "percent" ? n / 100 : n;
        }
      }
      if (typeof value === "number" && Number.isNaN(value)) {
        toast({ title: "Valor inválido", description: `Campo "${k}" não é um número válido.`, variant: "destructive" });
        return;
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (patch as any)[k] = value;
    }
    if (!isSubscriptionMode) {
      const bs = Number(patch.base_software_brl ?? row.base_software_brl ?? 0) || 0;
      const bt = Number(patch.base_tef_brl ?? row.base_tef_brl ?? 0) || 0;
      const computedPrice = Number((bs + bt).toFixed(2));
      if (computedPrice !== Number(row.price_brl)) patch.price_brl = computedPrice;
    }

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
          <Skeleton key={i} className="h-56 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">
          Nenhum plano cadastrado para o módulo <code>{module}</code> em <code>billing.module_plans</code>.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-xs">
        <Database className="h-4 w-4 text-primary mt-0.5 shrink-0" />
        <div>
          <p className="font-medium text-foreground">Catálogo · edição direta no banco</p>
          <p className="text-muted-foreground">
            Alterações vão para <code>billing.module_plans</code> e refletem imediatamente no Catálogo, na Prévia de Faturamento e nas licenças vendidas.
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {rows.map((row) => {
          const isDirty = dirtyMap[row.id];
          const isInactive = !row.is_active;
          const isHighlight = (row.tier ?? "").toLowerCase() === "standard";
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
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {isDirty && (
                    <span className="text-[10px] text-primary font-medium">pendente</span>
                  )}
                  <span
                    className={[
                      "h-2 w-2 rounded-full",
                      isInactive
                        ? "bg-muted-foreground/40"
                        : "bg-success shadow-[0_0_8px_hsl(var(--success)/0.5)]",
                    ].join(" ")}
                  />
                </div>
              </div>

              <div className="mt-auto space-y-3 pt-4 border-t border-border/50">
                <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">
                  Estrutura de Preço
                </p>
                <div className="flex items-baseline justify-between">
                  <span className="text-xs text-muted-foreground">Preço Base</span>
                  <span className="text-lg font-bold text-foreground tabular-nums">{brl(row.price_brl)}</span>
                </div>
                <div className="rounded-md bg-muted/30 border border-border/50 p-2 space-y-1">
                  <div className="flex justify-between text-[10px] text-muted-foreground uppercase tracking-wide">
                    <span>Sistema</span><span>Extra/disp.</span>
                  </div>
                  <div className="flex justify-between text-sm tabular-nums">
                    <span className="text-foreground">{brl(row.base_software_brl)}</span>
                    <span className="text-primary font-semibold">+ {brl(row.additional_software_brl)}</span>
                  </div>
                </div>
                <div className="rounded-md bg-muted/30 border border-border/50 p-2 space-y-1">
                  <div className="flex justify-between text-[10px] text-muted-foreground uppercase tracking-wide">
                    <span>Taxa TEF</span><span>Extra/disp.</span>
                  </div>
                  <div className="flex justify-between text-sm tabular-nums">
                    <span className="text-foreground">{brl(row.base_tef_brl)}</span>
                    <span className="text-primary font-semibold">+ {brl(row.additional_tef_brl)}</span>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-border/40 flex items-center justify-between text-[10px] text-muted-foreground">
                <span className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 text-primary">
                  <Pencil className="h-3 w-3" /> editar
                </span>
                <span>{row.max_users ? `${row.max_users} usr` : "∞ usr"}</span>
              </div>
            </button>
          );
        })}
      </div>

      {rows.map((row) => {
        if (editingId !== row.id) return null;
        const isDirty = dirtyMap[row.id];
        const draft = drafts[row.id] ?? {};
        const currentValue = (key: keyof ModulePlanPatch): unknown => {
          if (key in draft) return draft[key];
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          return (row as any)[key];
        };
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
              <Tabs defaultValue="identificacao" className="mt-2">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="identificacao">Identificação</TabsTrigger>
                  <TabsTrigger value="precos">Preços</TabsTrigger>
                  <TabsTrigger value="limites">Limites & Flags</TabsTrigger>
                  <TabsTrigger value="descontos">Descontos</TabsTrigger>
                </TabsList>

                {(["identificacao", "precos", "limites"] as const).map((groupId) => (
                  <TabsContent key={groupId} value={groupId} className="space-y-3 pt-4">
                    {FIELD_LAYOUT[groupId].map((sub) => (
                      <div
                        key={sub.title}
                       className={[
                          "rounded-lg border p-4 shadow-md",
                          sub.highlight
                            ? "border-primary/50 bg-primary/15 ring-1 ring-primary/30"
                            : "border-border bg-background/60",
                        ].join(" ")}
                      >
                        <div className="mb-3">
                          <h4 className="text-xs font-bold uppercase tracking-widest text-foreground">
                            {sub.title}
                          </h4>
                          {sub.description && (
                            <p className="text-[11px] text-muted-foreground mt-0.5">{sub.description}</p>
                          )}
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          {sub.keys.map((key) => {
                            const f = fieldByKey(key);
                            if (!f) return null;
                            // Modo assinatura simples: sem composição Sistema/TEF — price_brl é editável.
                            const subscriptionMode =
                              Number(currentValue("base_software_brl") ?? 0) === 0 &&
                              Number(currentValue("base_tef_brl") ?? 0) === 0;
                            let value = currentValue(f.key);
                            if (f.key === "price_brl") {
                              if (!subscriptionMode) {
                                const bs = Number(currentValue("base_software_brl") ?? 0) || 0;
                                const bt = Number(currentValue("base_tef_brl") ?? 0) || 0;
                                value = Number((bs + bt).toFixed(2));
                              }
                            }
                            const fieldReadOnly = f.key === "price_brl" ? !subscriptionMode : f.readOnly;
                            const fieldLabel = f.key === "price_brl" && subscriptionMode
                              ? "Preço/mês (assinatura)"
                              : f.label;
                            const fieldHint = f.key === "price_brl" && subscriptionMode
                              ? "Valor cobrado mensalmente"
                              : f.hint;
                            const raw = rawFromValue(f, value);
                            return (
                              <div key={f.key} className="space-y-1">
                                <Label className="text-xs flex items-center justify-between gap-2">
                                  <span>{fieldLabel}</span>
                                  {fieldHint && <span className="text-[10px] font-normal text-muted-foreground">{fieldHint}</span>}
                                </Label>
                                <div className="relative">
                                  {f.type === "currency" && (
                                    <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground">
                                      R$
                                    </span>
                                  )}
                                  {f.type === "percent" && (
                                    <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground">
                                      %
                                    </span>
                                  )}
                                  <Input
                                    value={raw}
                                    readOnly={fieldReadOnly}
                                    disabled={fieldReadOnly}
                                    type={f.type === "text" || f.type === "currency" || f.type === "percent" ? "text" : "number"}
                                    inputMode={f.type === "currency" || f.type === "percent" ? "decimal" : f.type === "integer" ? "numeric" : undefined}
                                    onChange={(e) => !fieldReadOnly && setField(row.id, f.key, parseValue(f, e.target.value))}
                                     className={[
                                       "h-9 text-sm tabular-nums bg-muted/40 border-border",
                                      f.type === "currency" ? "pl-8 text-right" : "",
                                      f.type === "percent" ? "pr-7 text-right" : "",
                                      fieldReadOnly ? "bg-muted/40 cursor-not-allowed" : "",
                                    ].join(" ")}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}

                    {groupId === "limites" && (
                      <div className="rounded-lg border border-border bg-background/60 p-4 shadow-md">
                        <div className="mb-3">
                          <h4 className="text-xs font-bold uppercase tracking-widest text-foreground">
                            Status do plano
                          </h4>
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            Visibilidade e disponibilidade comercial.
                          </p>
                        </div>
                        <div className="grid gap-2 sm:grid-cols-3">
                          {FLAGS.map((f) => {
                            const value = Boolean(currentValue(f.key));
                            return (
                              <label key={f.key} className="flex items-start gap-2 rounded-md border border-border bg-card px-2.5 py-2 cursor-pointer hover:bg-muted/40 transition-colors">
                                <Switch checked={value} onCheckedChange={(c) => setField(row.id, f.key, c)} />
                                <div className="min-w-0">
                                  <div className="text-xs font-medium">{f.label}</div>
                                  {f.hint && <div className="text-[10px] text-muted-foreground">{f.hint}</div>}
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </TabsContent>
                ))}

                <TabsContent value="descontos" className="pt-4">
                  <Tabs defaultValue="device" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="device">Por dispositivos</TabsTrigger>
                      <TabsTrigger value="store">Por lojas</TabsTrigger>
                    </TabsList>
                    <TabsContent value="device" className="pt-3">
                      <VolumeDiscountEditor
                        tiers={normalizeVolumeDiscounts(currentValue("volume_discounts"))}
                        onChange={(next) => setField(row.id, "volume_discounts", next)}
                      />
                    </TabsContent>
                    <TabsContent value="store" className="pt-3">
                      <VolumeDiscountEditor
                        scope="store"
                        tiers={normalizeVolumeDiscounts(currentValue("store_volume_discounts"))}
                        onChange={(next) => setField(row.id, "store_volume_discounts", next)}
                      />
                    </TabsContent>
                  </Tabs>
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

interface VolumeDiscountEditorProps {
  tiers: VolumeDiscountTier[];
  onChange: (next: VolumeDiscountTier[]) => void;
  scope?: "device" | "store";
}

function VolumeDiscountEditor({ tiers, onChange, scope = "device" }: VolumeDiscountEditorProps) {
  const labels = scope === "store"
    ? { title: "Desconto progressivo por lojas", unit: "lojas", help: "Aplicado sobre o software quando a empresa contrata várias lojas." }
    : { title: "Desconto progressivo por dispositivos", unit: "disp.", help: "Aplicado somente sobre o software (base + adicionais). TEF e PIX não recebem desconto." };
  const update = (idx: number, patch: Partial<VolumeDiscountTier>) => {
    onChange(tiers.map((t, i) => (i === idx ? { ...t, ...patch } : t)));
  };
  const remove = (idx: number) => onChange(tiers.filter((_, i) => i !== idx));
  const add = () => {
    const lastMax = tiers.length ? (tiers[tiers.length - 1].max_devices ?? tiers[tiers.length - 1].min_devices) : 1;
    onChange([...tiers, { min_devices: Number(lastMax) + 1, max_devices: null, percent: 5 }]);
  };
  const parseIntOrNull = (raw: string): number | null => {
    if (raw.trim() === "") return null;
    const n = Number(raw.replace(/\D/g, ""));
    return Number.isFinite(n) ? n : null;
  };
  const parsePct = (raw: string): number => {
    const cleaned = raw.replace(/\./g, "").replace(",", ".");
    const n = Number(cleaned);
    return Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : 0;
  };

  return (
    <div className="pt-2 border-t border-border/50 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <TrendingDown className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs font-medium">{labels.title}</span>
        </div>
        <Button type="button" size="sm" variant="outline" className="h-7 text-[11px]" onClick={add}>
          <Plus className="h-3 w-3 mr-1" /> Adicionar faixa
        </Button>
      </div>
      <p className="text-[10px] text-muted-foreground">{labels.help}</p>
      {tiers.length === 0 ? (
        <div className="text-[11px] text-muted-foreground italic rounded-md border border-dashed border-border/60 px-3 py-2">
          Nenhuma faixa configurada — sem desconto por volume.
        </div>
      ) : (
        <div className="space-y-1.5">
          {tiers.map((t, idx) => (
            <div key={idx} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 items-end rounded-md border border-border bg-background/60 px-2 py-2 shadow-sm">
              <div className="space-y-0.5">
                <Label className="text-[10px] text-muted-foreground">De ({labels.unit})</Label>
                <Input type="text" inputMode="numeric" value={String(t.min_devices)}
                  onChange={(e) => update(idx, { min_devices: parseIntOrNull(e.target.value) ?? 1 })}
                  className="h-8 text-xs tabular-nums" />
              </div>
              <div className="space-y-0.5">
                <Label className="text-[10px] text-muted-foreground">Até ({labels.unit}, vazio = sem teto)</Label>
                <Input type="text" inputMode="numeric" placeholder="∞"
                  value={t.max_devices == null ? "" : String(t.max_devices)}
                  onChange={(e) => update(idx, { max_devices: parseIntOrNull(e.target.value) })}
                  className="h-8 text-xs tabular-nums" />
              </div>
              <div className="space-y-0.5">
                <Label className="text-[10px] text-muted-foreground">Desconto (%)</Label>
                <Input type="text" inputMode="decimal" value={String(t.percent).replace(".", ",")}
                  onChange={(e) => update(idx, { percent: parsePct(e.target.value) })}
                  className="h-8 text-xs tabular-nums" />
              </div>
              <Button type="button" size="icon" variant="ghost"
                className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={() => remove(idx)} aria-label="Remover faixa">
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}