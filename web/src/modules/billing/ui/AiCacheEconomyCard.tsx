"use client";

/**
 * Painel "Economia de Cache (IA)" — mede aproveitamento do prompt caching
 * da OpenAI e a economia gerada em R$.
 * Fontes: billing.usage_log (tokens_cached) + billing.model_costs.real_cost_usd_per_1k
 * + cotação USD/BRL ao vivo (awesomeapi).
 */
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Database, Zap, Info, RefreshCw } from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Skeleton } from "@/shared/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { Button } from "@/shared/ui/button";
import { cn } from "@/shared/lib/utils";
import { fetchAiModelCostsAdmin } from "@/modules/billing/infrastructure/ai-credits-admin";
import {
  aggregateByModel,
  aggregateDaily,
  computeKpis,
  fetchAiCacheRows,
  totalSavingsBrl,
  CACHE_DISCOUNT,
} from "@/modules/billing/infrastructure/ai-cache";

const DEFAULT_REFERENCE = 5.25;
const brlFmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const brl4Fmt = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 4,
  maximumFractionDigits: 4,
});
const intFmt = new Intl.NumberFormat("pt-BR");

async function fetchUsdBrl(): Promise<number> {
  try {
    const res = await fetch("https://economia.awesomeapi.com.br/json/last/USD-BRL");
    const data = await res.json();
    const bid = parseFloat(data?.USDBRL?.bid ?? String(DEFAULT_REFERENCE));
    return Number.isFinite(bid) && bid > 0 ? bid : DEFAULT_REFERENCE;
  } catch {
    return DEFAULT_REFERENCE;
  }
}

type AppFilter = "easyml" | "all";

export function AiCacheEconomyCard() {
  const [days, setDays] = useState<7 | 30 | 90>(30);
  const [app, setApp] = useState<AppFilter>("easyml");

  const rowsQ = useQuery({
    queryKey: ["ai-cache-rows", days, app],
    queryFn: () => fetchAiCacheRows({ days, app }),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
  const modelsQ = useQuery({
    queryKey: ["ai-model-costs-admin"],
    queryFn: fetchAiModelCostsAdmin,
    staleTime: 60_000,
  });
  const rateQ = useQuery({
    queryKey: ["usd-brl-rate"],
    queryFn: fetchUsdBrl,
    staleTime: 5 * 60_000,
    refetchInterval: 5 * 60_000,
    refetchIntervalInBackground: true,
  });

  const loading = rowsQ.isLoading || modelsQ.isLoading || rateQ.isLoading;
  const usdBrl = rateQ.data ?? DEFAULT_REFERENCE;

  const costByKey = useMemo(() => {
    const m = new Map<string, number>();
    for (const row of modelsQ.data ?? []) {
      if (row.real_cost_usd_per_1k != null) m.set(row.model_key, Number(row.real_cost_usd_per_1k));
    }
    return m;
  }, [modelsQ.data]);

  const rows = rowsQ.data ?? [];
  const kpis = useMemo(() => computeKpis(rows), [rows]);
  const byModel = useMemo(() => aggregateByModel(rows, costByKey, usdBrl), [rows, costByKey, usdBrl]);
  const daily = useMemo(() => aggregateDaily(rows, days), [rows, days]);
  const savingsBrl = totalSavingsBrl(byModel);

  const displayNameByKey = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of modelsQ.data ?? []) m.set(r.model_key, r.display_name);
    return m;
  }, [modelsQ.data]);

  return (
    <div className="rounded-lg border border-border/60 bg-card/40 p-4 md:p-6 space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="rounded-md bg-info/10 p-2 text-info">
            <Database className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
              Economia de Cache (IA) <Zap className="h-4 w-4 text-warning" />
            </h3>
            <p className="text-xs text-muted-foreground max-w-xl">
              Reaproveitamento do prompt caching da OpenAI no chat de IA — reduz nosso custo real
              de provedor sem alterar o que o cliente paga.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select value={app} onValueChange={(v) => setApp(v as AppFilter)}>
            <SelectTrigger className="h-8 w-[140px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="easyml">EasyML</SelectItem>
              <SelectItem value="all">Todos os apps</SelectItem>
            </SelectContent>
          </Select>
          <Select value={String(days)} onValueChange={(v) => setDays(Number(v) as 7 | 30 | 90)}>
            <SelectTrigger className="h-8 w-[120px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Últimos 7 dias</SelectItem>
              <SelectItem value="30">Últimos 30 dias</SelectItem>
              <SelectItem value="90">Últimos 90 dias</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            className="h-8"
            onClick={() => {
              rowsQ.refetch();
              rateQ.refetch();
            }}
          >
            <RefreshCw className={cn("h-3.5 w-3.5", rowsQ.isFetching && "animate-spin")} />
          </Button>
        </div>
      </div>

      {loading ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Kpi
              label="Taxa de cache hit"
              value={`${kpis.cache_hit_pct.toFixed(1)}%`}
              tone="info"
              hint={`${intFmt.format(kpis.sum_cached)} / ${intFmt.format(kpis.sum_input)} tokens`}
            />
            <Kpi
              label="Tokens economizados"
              value={intFmt.format(kpis.sum_cached)}
              tone="primary"
              hint="Cacheados no período"
            />
            <Kpi
              label="Economia estimada"
              value={brlFmt.format(savingsBrl)}
              tone="success"
              hint={`USD/BRL ${brl4Fmt.format(usdBrl)}`}
            />
            <Kpi
              label="Interações"
              value={intFmt.format(kpis.interactions)}
              tone="muted"
              hint="Chamadas com IA"
            />
          </div>

          <div className="rounded-md border border-border/60 bg-background/40 p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground">
                Tokens de entrada vs. cacheados (por dia)
              </p>
              <p className="text-[10px] text-muted-foreground">Fuso America/Sao_Paulo</p>
            </div>
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={daily} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                  <defs>
                    <linearGradient id="cacheInput" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--info))" stopOpacity={0.45} />
                      <stop offset="95%" stopColor="hsl(var(--info))" stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="cacheCached" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--success))" stopOpacity={0.55} />
                      <stop offset="95%" stopColor="hsl(var(--success))" stopOpacity={0.04} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" opacity={0.4} />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                    tickFormatter={(d: string) => d.slice(5)}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                    tickFormatter={(n: number) => intFmt.format(n)}
                    width={56}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    formatter={(v: number, name: string) => [
                      intFmt.format(v),
                      name === "sum_input" ? "Tokens de entrada" : "Tokens cacheados",
                    ]}
                    labelFormatter={(l: string) => `Dia ${l}`}
                  />
                  <Area
                    type="monotone"
                    dataKey="sum_input"
                    stroke="hsl(var(--info))"
                    fill="url(#cacheInput)"
                    strokeWidth={2}
                  />
                  <Area
                    type="monotone"
                    dataKey="sum_cached"
                    stroke="hsl(var(--success))"
                    fill="url(#cacheCached)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                  <th className="px-2 py-2">Modelo</th>
                  <th className="px-2 py-2 text-right">Tokens entrada</th>
                  <th className="px-2 py-2 text-right">Tokens cacheados</th>
                  <th className="px-2 py-2 text-right">Cache hit %</th>
                  <th className="px-2 py-2 text-right">Economia (R$)</th>
                </tr>
              </thead>
              <tbody>
                {byModel.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-2 py-6 text-center text-xs text-muted-foreground">
                      Sem dados de IA no período selecionado.
                    </td>
                  </tr>
                ) : (
                  byModel.map((m) => (
                    <tr key={m.model_used} className="border-b last:border-0">
                      <td className="px-2 py-2 text-foreground">
                        <div className="font-medium">
                          {displayNameByKey.get(m.model_used) ?? m.model_used}
                        </div>
                        <div className="text-[10px] text-muted-foreground">{m.model_used}</div>
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums">{intFmt.format(m.sum_input)}</td>
                      <td className="px-2 py-2 text-right tabular-nums text-success">
                        {intFmt.format(m.sum_cached)}
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums">
                        {m.cache_hit_pct.toFixed(1)}%
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums font-medium text-success">
                        {brlFmt.format(m.savings_brl)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-start gap-3 rounded-md border border-info/30 bg-info/5 p-3 text-xs text-muted-foreground">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-info" />
            <div className="space-y-1">
              <p>
                O cache reaproveita o trecho fixo de cada pergunta (system prompt + base de
                conhecimento + ferramentas). Isso <strong className="text-foreground">não altera</strong> os
                créditos cobrados do cliente — apenas reduz nosso custo de provedor (~{(CACHE_DISCOUNT * 100).toFixed(0)}% de
                desconto nos tokens de entrada cacheados).
              </p>
              <p>
                Cotação USD/BRL atual:{" "}
                <span className="font-medium text-foreground">{brl4Fmt.format(usdBrl)}</span>. Economia
                em R$ é estimativa baseada em <code className="rounded bg-muted/40 px-1">real_cost_usd_per_1k</code>{" "}
                de cada modelo.
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Kpi({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone: "info" | "success" | "primary" | "muted";
}) {
  const toneCls =
    tone === "success"
      ? "border-success/30 bg-success/5 text-success"
      : tone === "info"
        ? "border-info/30 bg-info/5 text-info"
        : tone === "primary"
          ? "border-primary/30 bg-primary/5 text-primary"
          : "border-border bg-muted/20 text-foreground";
  return (
    <div className={cn("rounded-md border p-3", toneCls)}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-semibold tabular-nums">{value}</div>
      {hint && <div className="text-[10px] text-muted-foreground">{hint}</div>}
    </div>
  );
}