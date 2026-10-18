"use client";

/**
 * Card admin para gerenciar a página /ai-credits do EasyBilling.
 * Edita pacotes de créditos e custos por modelo de IA.
 */
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@/shared/http/server-fn";
import { toast } from "sonner";
import { Save, RotateCcw, RefreshCw } from "lucide-react";
import { CollapsibleCard } from "@/shared/layout/collapsible-card";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Switch } from "@/shared/ui/switch";
import { Skeleton } from "@/shared/ui/skeleton";
import {
  fetchAiCreditPackagesAdmin,
  updateAiCreditPackage,
  fetchAiModelCostsAdmin,
  updateAiModelCost,
  type AiCreditPackageRow,
  type AiCreditPackagePatch,
  type AiModelCostRow,
  type AiModelCostPatch,
} from "@/modules/billing/infrastructure/ai-credits-admin";
import { syncAiCreditsStripePriceIds } from "@/modules/billing/infrastructure/stripe-sync.functions";
import { MarginMonitorSection } from "./MarginMonitorSection";

const PKG_KEY = ["ai-credit-packages-admin"] as const;
const MODEL_KEY = ["ai-model-costs-admin"] as const;

const usdFmt = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 20,
});

const brlFmt = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

function BrlInput({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const [focused, setFocused] = useState(false);
  const [raw, setRaw] = useState<string>(String(value ?? 0));

  useEffect(() => {
    if (!focused) setRaw(String(value ?? 0));
  }, [value, focused]);

  return (
    <Input
      inputMode="decimal"
      value={focused ? raw : brlFmt.format(Number(value) || 0)}
      onFocus={() => {
        setRaw(String(value ?? 0));
        setFocused(true);
      }}
      onChange={(e) => {
        const s = e.target.value.replace(/[^\d.,-]/g, "").replace(",", ".");
        setRaw(s);
        const n = Number(s);
        if (Number.isFinite(n)) onChange(Math.max(0, n));
      }}
      onBlur={() => setFocused(false)}
      className="h-9 w-full min-w-[7rem] text-sm tabular-nums text-right"
    />
  );
}

function CurrencyInput({
  value,
  onChange,
  placeholder,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  placeholder?: string;
}) {
  const [focused, setFocused] = useState(false);
  const [draft, setDraft] = useState<string>(value == null ? "" : String(value));

  useEffect(() => {
    if (!focused) setDraft(value == null ? "" : String(value));
  }, [value, focused]);

  const display = focused
    ? draft
    : value == null || Number.isNaN(value)
      ? ""
      : usdFmt.format(value);

  return (
    <Input
      value={display}
      placeholder={placeholder ?? "$0.00"}
      onFocus={() => {
        setFocused(true);
        setDraft(value == null ? "" : String(value));
      }}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        setFocused(false);
        const cleaned = draft.replace(/[^\d.,-]/g, "").replace(",", ".");
        if (cleaned === "" || cleaned === "-") {
          onChange(null);
          return;
        }
        const n = Number(cleaned);
        onChange(Number.isFinite(n) ? n : null);
      }}
    />
  );
}

function diffPatch<T extends Record<string, unknown>>(original: T, draft: T): Partial<T> {
  const out: Partial<T> = {};
  for (const k of Object.keys(draft) as (keyof T)[]) {
    if (original[k] !== draft[k]) out[k] = draft[k];
  }
  return out;
}

function PackagesSection() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: PKG_KEY, queryFn: fetchAiCreditPackagesAdmin });
  const [drafts, setDrafts] = useState<Record<string, AiCreditPackageRow>>({});

  useEffect(() => {
    if (data) {
      const next: Record<string, AiCreditPackageRow> = {};
      data.forEach((r) => (next[r.id] = r));
      setDrafts(next);
    }
  }, [data]);

  const m = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: AiCreditPackagePatch }) => {
      await updateAiCreditPackage(id, patch);
    },
    onSuccess: () => {
      toast.success("Pacote salvo");
      qc.invalidateQueries({ queryKey: PKG_KEY });
      qc.invalidateQueries({ queryKey: ["ai-credit-packages"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const update = (id: string, patch: Partial<AiCreditPackageRow>) => {
    setDrafts((d) => ({ ...d, [id]: { ...d[id], ...patch } }));
  };

  if (isLoading) return <Skeleton className="h-40 w-full" />;
  const rows = data ?? [];
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">Nenhum pacote cadastrado.</p>;

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1000px] text-sm">
          <thead>
            <tr className="border-b text-left text-xs uppercase text-muted-foreground">
              <th className="px-2 py-2">Slug</th>
              <th className="px-2 py-2">Nome</th>
              <th className="px-2 py-2 w-24">Créditos</th>
              <th className="px-2 py-2 w-24">Bônus</th>
              <th className="px-2 py-2 w-36">Preço (BRL)</th>
              <th className="px-2 py-2 w-24">Validade (dias)</th>
              <th className="px-2 py-2 w-20">Ordem</th>
              <th className="px-2 py-2 w-20">Destaque</th>
              <th className="px-2 py-2 w-20">Ativo</th>
              <th className="px-2 py-2">Stripe price id</th>
              <th className="px-2 py-2 w-40">Ações</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const d = drafts[r.id] ?? r;
              const dirty = Object.keys(diffPatch(r as never, d as never)).length > 0;
              return (
                <tr key={r.id} className="border-b">
                  <td className="px-2 py-2 font-mono text-xs">{r.slug}</td>
                  <td className="px-2 py-2">
                    <Input value={d.name} onChange={(e) => update(r.id, { name: e.target.value })} />
                  </td>
                  <td className="px-2 py-2">
                    <Input type="number" step="1" value={d.credits} onChange={(e) => update(r.id, { credits: Number(e.target.value) })} />
                  </td>
                  <td className="px-2 py-2">
                    <Input type="number" step="1" value={d.bonus_credits} onChange={(e) => update(r.id, { bonus_credits: Number(e.target.value) })} />
                  </td>
                  <td className="px-2 py-2">
                    <BrlInput value={d.price_brl ?? 0} onChange={(v) => update(r.id, { price_brl: v })} />
                  </td>
                  <td className="px-2 py-2">
                    <Input type="number" step="1" value={d.validity_days} onChange={(e) => update(r.id, { validity_days: Number(e.target.value) })} />
                  </td>
                  <td className="px-2 py-2">
                    <Input type="number" step="1" value={d.sort_order} onChange={(e) => update(r.id, { sort_order: Number(e.target.value) })} />
                  </td>
                  <td className="px-2 py-2">
                    <Switch checked={d.highlight} onCheckedChange={(v) => update(r.id, { highlight: v })} />
                  </td>
                  <td className="px-2 py-2">
                    <Switch checked={d.is_active} onCheckedChange={(v) => update(r.id, { is_active: v })} />
                  </td>
                  <td className="px-2 py-2">
                    <Input value={d.stripe_price_id ?? ""} onChange={(e) => update(r.id, { stripe_price_id: e.target.value || null })} placeholder="price_..." />
                  </td>
                  <td className="px-2 py-2">
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        disabled={!dirty || m.isPending}
                        onClick={() => {
                          const patch = diffPatch(r as never, d as never) as AiCreditPackagePatch;
                          // total_credits é GENERATED ALWAYS (credits+bonus) — não pode ser enviado
                          delete (patch as { total_credits?: unknown }).total_credits;
                          m.mutate({ id: r.id, patch });
                        }}
                      >
                        <Save className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={!dirty}
                        onClick={() => update(r.id, r)}
                      >
                        <RotateCcw className="h-3 w-3" />
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ModelsSection() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: MODEL_KEY, queryFn: fetchAiModelCostsAdmin });
  const [drafts, setDrafts] = useState<Record<string, AiModelCostRow>>({});

  useEffect(() => {
    if (data) {
      const next: Record<string, AiModelCostRow> = {};
      data.forEach((r) => (next[r.id] = r));
      setDrafts(next);
    }
  }, [data]);

  const m = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: AiModelCostPatch }) => {
      await updateAiModelCost(id, patch);
    },
    onSuccess: () => {
      toast.success("Modelo salvo");
      qc.invalidateQueries({ queryKey: MODEL_KEY, refetchType: "all" });
      qc.invalidateQueries({ queryKey: ["ai-model-costs"], refetchType: "all" });
      qc.invalidateQueries({ queryKey: ["ai-credit-packages-admin"], refetchType: "all" });
      qc.invalidateQueries({ queryKey: ["billing-reference-usd-brl"], refetchType: "all" });
      qc.invalidateQueries({ queryKey: ["ai-cache-rows"], refetchType: "all" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const update = (id: string, patch: Partial<AiModelCostRow>) => {
    setDrafts((d) => ({ ...d, [id]: { ...d[id], ...patch } }));
  };

  if (isLoading) return <Skeleton className="h-40 w-full" />;
  const rows = data ?? [];
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">Nenhum modelo cadastrado.</p>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1200px] text-sm">
        <thead>
          <tr className="border-b text-left text-xs uppercase text-muted-foreground">
            <th className="px-2 py-2">Model key</th>
            <th className="px-2 py-2">Nome</th>
            <th className="px-2 py-2">Provider</th>
            <th className="px-2 py-2 w-36">Custo API / 1k (USD)</th>
            <th className="px-2 py-2 w-36">Custo API / imagem (USD)</th>
            <th className="px-2 py-2 w-32">Custo / 1k tokens</th>
            <th className="px-2 py-2 w-32">Custo / imagem</th>
            <th className="px-2 py-2 w-20">Padrão</th>
            <th className="px-2 py-2 w-20">Ativo</th>
            <th className="px-2 py-2 w-20">Ordem</th>
            <th className="px-2 py-2 w-40">Ações</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const d = drafts[r.id] ?? r;
            const dirty = Object.keys(diffPatch(r as never, d as never)).length > 0;
            return (
              <tr key={r.id} className="border-b">
                <td className="px-2 py-2 font-mono text-xs">{r.model_key}</td>
                <td className="px-2 py-2">
                  <Input value={d.display_name} onChange={(e) => update(r.id, { display_name: e.target.value })} />
                </td>
                <td className="px-2 py-2">
                  <Input value={d.provider} onChange={(e) => update(r.id, { provider: e.target.value })} />
                </td>
                <td className="px-2 py-2">
                  <CurrencyInput
                    value={d.real_cost_usd_per_1k}
                    onChange={(v) => update(r.id, { real_cost_usd_per_1k: v })}
                  />
                </td>
                <td className="px-2 py-2">
                  <CurrencyInput
                    value={d.real_cost_usd_per_image}
                    onChange={(v) => update(r.id, { real_cost_usd_per_image: v })}
                  />
                </td>
                <td className="px-2 py-2">
                  <BrlInput
                    value={d.cost_per_1k_tokens ?? 0}
                    onChange={(v) => update(r.id, { cost_per_1k_tokens: v })}
                  />
                </td>
                <td className="px-2 py-2">
                  <BrlInput
                    value={d.cost_per_image ?? 0}
                    onChange={(v) => update(r.id, { cost_per_image: v })}
                  />
                </td>
                <td className="px-2 py-2">
                  <Switch checked={d.is_default} onCheckedChange={(v) => update(r.id, { is_default: v })} />
                </td>
                <td className="px-2 py-2">
                  <Switch checked={d.is_active} onCheckedChange={(v) => update(r.id, { is_active: v })} />
                </td>
                <td className="px-2 py-2">
                  <Input type="number" step="1" value={d.sort_order} onChange={(e) => update(r.id, { sort_order: Number(e.target.value) })} />
                </td>
                <td className="px-2 py-2">
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      disabled={!dirty || m.isPending}
                      onClick={() => m.mutate({ id: r.id, patch: diffPatch(r as never, d as never) as AiModelCostPatch })}
                    >
                      <Save className="h-3 w-3" />
                    </Button>
                    <Button size="sm" variant="ghost" disabled={!dirty} onClick={() => update(r.id, r)}>
                      <RotateCcw className="h-3 w-3" />
                    </Button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function AiCreditsAdminCard() {
  const pkgCount = useQuery({ queryKey: PKG_KEY, queryFn: fetchAiCreditPackagesAdmin });
  const modelCount = useQuery({ queryKey: MODEL_KEY, queryFn: fetchAiModelCostsAdmin });
  const pkgLabel = useMemo(() => `${pkgCount.data?.length ?? 0} pacote(s)`, [pkgCount.data]);
  const modelLabel = useMemo(() => `${modelCount.data?.length ?? 0} modelo(s)`, [modelCount.data]);
  const qc = useQueryClient();
  const syncFn = useServerFn(syncAiCreditsStripePriceIds);
  const syncMutation = useMutation({
    mutationFn: () => syncFn({}),
    onSuccess: (res) => {
      toast.success(
        `Stripe (${res.mode}) sincronizado: ${res.updated} atualizado(s), ${res.matched}/${res.scanned} casados.`,
      );
      qc.invalidateQueries({ queryKey: PKG_KEY });
      qc.invalidateQueries({ queryKey: ["ai-credit-packages"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <CollapsibleCard
      title="Créditos de IA"
      description="Gerencia o conteúdo exibido em /ai-credits — pacotes vendidos e tabela de custos por modelo."
    >
      <div className="space-y-3">
        <CollapsibleCard title="Pacotes de créditos" description={`${pkgLabel} · valores exibidos no checkout.`}>
          <div className="mb-3 flex justify-end">
            <Button
              size="sm"
              variant="outline"
              disabled={syncMutation.isPending}
              onClick={() => syncMutation.mutate()}
            >
              <RefreshCw className={`mr-2 h-3 w-3 ${syncMutation.isPending ? "animate-spin" : ""}`} />
              Sincronizar Stripe price IDs
            </Button>
          </div>
          <PackagesSection />
        </CollapsibleCard>
        <CollapsibleCard title="Custos por modelo" description={`${modelLabel} · usado para debitar créditos por chamada.`}>
          <ModelsSection />
        </CollapsibleCard>
        <CollapsibleCard
          title="Monitor de Margem"
          description="Margem de lucro por modelo de IA com cotação USD/BRL ao vivo."
        >
          <MarginMonitorSection />
        </CollapsibleCard>
      </div>
    </CollapsibleCard>
  );
}