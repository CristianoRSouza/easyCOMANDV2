"use client";

/**
 * Aba de Bases de Cálculo (billing.config).
 * Edita custo TEF, quotas IA, etc. Apenas system_admin (RLS).
 */
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Badge } from "@/shared/ui/badge";
import { Skeleton } from "@/shared/ui/skeleton";
import { Save, RotateCcw, ShieldCheck } from "lucide-react";
import { useToast } from "@/shared/hooks/use-toast";
import {
  describeBillingError,
  fetchBillingConfig,
  updateBillingConfigValue,
  type BillingConfigRow,
} from "@/modules/billing/infrastructure/queries";

const numericValueSchema = z.object({
  default: z
    .number({ invalid_type_error: "Informe um número válido" })
    .min(0, "Não pode ser negativo")
    .max(1_000_000, "Valor muito alto"),
});

interface DraftMap {
  [id: string]: { raw: string; dirty: boolean; error?: string };
}

const CATEGORY_LABELS: Record<string, string> = {
  tef_cost: "Custo do TEF (provedor)",
  ai: "Inteligência Artificial",
  license: "Licenciamento",
  module: "Módulos",
  general: "Geral",
};

const CATEGORY_DESCRIPTIONS: Record<string, string> = {
  tef_cost: "Custo real cobrado pelo provedor de TEF — usado para calcular margem.",
  ai: "Quotas e custos de IA cobrados em créditos.",
  license: "Configurações padrão de licenciamento.",
  module: "Módulos disponíveis na plataforma.",
  general: "Configurações gerais.",
};

const FIELD_LABELS: Record<string, string> = {
  default: "Padrão", plan: "Plano", plans: "Planos", modules: "Módulos",
  max_users: "Máx. usuários", max_stores: "Máx. lojas", enabled: "Habilitado",
};

const prettyKey = (k: string) =>
  FIELD_LABELS[k] ?? k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

const formatPrimitive = (v: unknown): string => {
  if (v === null || v === undefined) return "—";
  if (typeof v === "boolean") return v ? "Sim" : "Não";
  if (typeof v === "number") return new Intl.NumberFormat("pt-BR").format(v);
  return String(v);
};

function isNumericConfig(row: BillingConfigRow): boolean {
  return typeof row.value?.default === "number";
}

function ConfigValueView({ value }: { value: unknown }) {
  if (value === null || value === undefined) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="text-xs text-muted-foreground italic">vazio</span>;
    return (
      <div className="flex flex-wrap gap-1 justify-end">
        {value.map((item, i) => (
          <Badge key={i} variant="secondary" className="text-[10px] font-normal px-1.5 py-0.5">
            {typeof item === "object" ? JSON.stringify(item) : formatPrimitive(item)}
          </Badge>
        ))}
      </div>
    );
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return <span className="text-xs text-muted-foreground italic">vazio</span>;
    return (
      <dl className="space-y-0.5 text-xs text-right">
        {entries.map(([k, v]) => (
          <div key={k} className="flex justify-end items-baseline gap-2">
            <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">{prettyKey(k)}</dt>
            <dd className="font-medium tabular-nums">
              {Array.isArray(v) ? (
                <span className="inline-flex flex-wrap gap-1 justify-end">
                  {v.map((it, i) => (
                    <Badge key={i} variant="outline" className="text-[10px] font-normal px-1.5 py-0">
                      {typeof it === "object" ? JSON.stringify(it) : formatPrimitive(it)}
                    </Badge>
                  ))}
                </span>
              ) : typeof v === "object" && v !== null ? (
                <span className="text-[10px] text-muted-foreground">{Object.keys(v as object).length} campos</span>
              ) : (
                formatPrimitive(v)
              )}
            </dd>
          </div>
        ))}
      </dl>
    );
  }
  return <span className="text-sm font-medium tabular-nums">{formatPrimitive(value)}</span>;
}

export function BillingConfigTab() {
  const { toast } = useToast();
  const [rows, setRows] = useState<BillingConfigRow[]>([]);
  const [drafts, setDrafts] = useState<DraftMap>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await fetchBillingConfig();
      setRows(data);
      const initial: DraftMap = {};
      for (const r of data) {
        if (isNumericConfig(r)) {
          initial[r.id] = { raw: String(r.value.default), dirty: false };
        }
      }
      setDrafts(initial);
    } catch (e) {
      toast({ title: "Erro ao carregar configurações", description: describeBillingError(e), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); /* eslint-disable-next-line */ }, []);

  const grouped = useMemo(() => {
    const g: Record<string, BillingConfigRow[]> = {};
    for (const r of rows) (g[r.category] ||= []).push(r);
    return g;
  }, [rows]);

  const onChange = (row: BillingConfigRow, raw: string) => {
    const num = Number(raw.replace(",", "."));
    const parsed = numericValueSchema.safeParse({ default: Number.isFinite(num) ? num : NaN });
    setDrafts((d) => ({
      ...d,
      [row.id]: { raw, dirty: raw !== String(row.value.default), error: parsed.success ? undefined : parsed.error.issues[0]?.message },
    }));
  };

  const onReset = (row: BillingConfigRow) => {
    setDrafts((d) => ({ ...d, [row.id]: { raw: String(row.value.default), dirty: false } }));
  };

  const onSave = async (row: BillingConfigRow) => {
    const draft = drafts[row.id];
    if (!draft || !draft.dirty || draft.error) return;
    const num = Number(draft.raw.replace(",", "."));
    if (!numericValueSchema.safeParse({ default: num }).success) return;
    setSavingId(row.id);
    try {
      await updateBillingConfigValue(row.id, { ...row.value, default: num });
      toast({ title: "Configuração salva", description: `${row.category} · ${row.key}` });
      await load();
    } catch (e) {
      toast({ title: "Falha ao salvar", description: describeBillingError(e), variant: "destructive" });
    } finally {
      setSavingId(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">
          Nenhuma configuração encontrada em <code>billing.config</code>.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-xs">
        <ShieldCheck className="h-4 w-4 text-primary mt-0.5 shrink-0" />
        <div>
          <p className="font-medium text-foreground">Acesso restrito ao administrador do sistema</p>
          <p className="text-muted-foreground">
            Alterações são gravadas direto em <code>billing.config</code> e refletem na próxima consulta. Sem deploy.
          </p>
        </div>
      </div>

      {Object.entries(grouped).map(([category, items]) => (
        <Card key={category}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div>
                <CardTitle className="text-base">{CATEGORY_LABELS[category] ?? category}</CardTitle>
                <CardDescription className="text-xs">{CATEGORY_DESCRIPTIONS[category] ?? "—"}</CardDescription>
              </div>
              <Badge variant="outline" className="text-[10px] uppercase tracking-wide">{category}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {items.map((row) => {
              const numeric = isNumericConfig(row);
              const draft = drafts[row.id];
              return (
                <div key={row.id} className="grid gap-2 sm:grid-cols-[1fr_180px_auto] sm:items-end pb-3 border-b border-border/50 last:border-0 last:pb-0">
                  <div className="min-w-0">
                    <Label className="text-xs font-mono text-foreground">{row.key}</Label>
                    {row.description && (
                      <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{row.description}</p>
                    )}
                  </div>
                  {numeric ? (
                    <div>
                      <Input
                        type="number" step="0.01" min={0}
                        value={draft?.raw ?? ""}
                        onChange={(e) => onChange(row, e.target.value)}
                        className={`h-9 text-sm tabular-nums ${draft?.error ? "border-destructive" : ""}`}
                      />
                      {draft?.error && <p className="text-[10px] text-destructive mt-1">{draft.error}</p>}
                    </div>
                  ) : (
                    <div className="rounded-md border border-border/60 bg-muted/30 px-2.5 py-1.5 min-w-0">
                      <ConfigValueView value={row.value} />
                    </div>
                  )}
                  {numeric ? (
                    <div className="flex gap-1.5">
                      <Button type="button" size="sm" variant="outline" className="h-9"
                        disabled={!draft?.dirty || savingId === row.id} onClick={() => onReset(row)}>
                        <RotateCcw className="h-3.5 w-3.5" />
                      </Button>
                      <Button type="button" size="sm" className="h-9 gap-1.5"
                        disabled={!draft?.dirty || !!draft?.error || savingId === row.id}
                        onClick={() => void onSave(row)}>
                        <Save className="h-3.5 w-3.5" /> Salvar
                      </Button>
                    </div>
                  ) : (
                    <Badge variant="secondary" className="text-[10px] justify-self-start">somente leitura</Badge>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}