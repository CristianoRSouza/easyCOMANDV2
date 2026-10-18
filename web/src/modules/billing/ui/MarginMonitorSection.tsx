"use client";

/**
 * Monitor de Margem — embutido no card de Créditos de IA.
 * Mostra margem de lucro por modelo de IA usando cotação USD/BRL ao vivo.
 */
import { Fragment } from "react";
import { useQuery } from "@tanstack/react-query";
import { TrendingUp, TrendingDown, AlertTriangle, CheckCircle2, XCircle, DollarSign, RefreshCw } from "lucide-react";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Skeleton } from "@/shared/ui/skeleton";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/shared/lib/utils";
import {
  fetchAiCreditPackagesAdmin,
  fetchReferenceUsdBrl,
  fetchAiModelCostsAdmin,
  type AiCreditPackageRow,
  type AiModelCostRow,
} from "@/modules/billing/infrastructure/ai-credits-admin";

const DEFAULT_REFERENCE = 5.25;
const ALERT_THRESHOLD_PCT = 5;

const brlFmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const brl4Fmt = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 4,
  maximumFractionDigits: 4,
});
const usdFmt = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 6,
});
const pctFmt = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;

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


interface ModelMargin {
  model_key: string;
  display_name: string;
  provider: string;
  cr_per_1k: number;
  cr_per_img: number | null;
  api_cost_usd_1k: number;
  api_cost_usd_img: number | null;
  api_cost_brl_1k: number;
  api_cost_brl_img: number | null;
  margins_text: { package_name: string; margin_pct: number; revenue_brl: number }[];
  margins_img: { package_name: string; margin_pct: number; revenue_brl: number }[] | null;
  worst_text: number;
  worst_img: number | null;
  status: "ok" | "warning" | "danger";
}

function computeMargins(
  models: AiModelCostRow[],
  packages: AiCreditPackageRow[],
  usdBrl: number,
): ModelMargin[] {
  return models
    .filter((m) => m.is_active && m.real_cost_usd_per_1k != null && (m.real_cost_usd_per_1k ?? 0) > 0)
    .map((m) => {
      const usd1k = m.real_cost_usd_per_1k as number;
      const usdImg = m.real_cost_usd_per_image ?? null;
      const costBrl1k = usd1k * usdBrl;
      const costBrlImg = usdImg != null ? usdImg * usdBrl : null;

      const activePkgs = packages.filter((p) => p.is_active);
      const marginsText = activePkgs.map((p) => {
        const rate = p.total_credits > 0 ? p.price_brl / p.total_credits : 0;
        const revenue = m.cost_per_1k_tokens * rate;
        const margin = costBrl1k > 0 ? ((revenue - costBrl1k) / costBrl1k) * 100 : 9999;
        return { package_name: p.name, margin_pct: margin, revenue_brl: revenue };
      });

      let marginsImg: ModelMargin["margins_img"] = null;
      if (m.cost_per_image && costBrlImg && costBrlImg > 0) {
        marginsImg = activePkgs.map((p) => {
          const rate = p.total_credits > 0 ? p.price_brl / p.total_credits : 0;
          const revenue = (m.cost_per_image as number) * rate;
          const margin = ((revenue - costBrlImg) / costBrlImg) * 100;
          return { package_name: p.name, margin_pct: margin, revenue_brl: revenue };
        });
      }

      const worstText = marginsText.length > 0 ? Math.min(...marginsText.map((x) => x.margin_pct)) : 0;
      const worstImg = marginsImg ? Math.min(...marginsImg.map((x) => x.margin_pct)) : null;
      const worstOverall = Math.min(worstText, worstImg ?? Infinity);
      const status: ModelMargin["status"] =
        worstOverall < 0 ? "danger" : worstOverall < 100 ? "warning" : "ok";

      return {
        model_key: m.model_key,
        display_name: m.display_name,
        provider: m.provider,
        cr_per_1k: m.cost_per_1k_tokens,
        cr_per_img: m.cost_per_image,
        api_cost_usd_1k: usd1k,
        api_cost_usd_img: usdImg,
        api_cost_brl_1k: costBrl1k,
        api_cost_brl_img: costBrlImg,
        margins_text: marginsText,
        margins_img: marginsImg,
        worst_text: worstText,
        worst_img: worstImg,
        status,
      };
    });
}

function MarginBadge({ pct }: { pct: number }) {
  const tone =
    pct < 0
      ? "bg-destructive/15 text-destructive border-destructive/30"
      : pct < 100
        ? "bg-warning/15 text-warning border-warning/30"
        : "bg-success/15 text-success border-success/30";
  return (
    <span className={cn("inline-flex items-center rounded-md border px-1.5 py-0.5 text-xs font-medium tabular-nums", tone)}>
      {pctFmt(pct)}
    </span>
  );
}

function StatusIcon({ status }: { status: ModelMargin["status"] }) {
  if (status === "ok") return <CheckCircle2 className="h-4 w-4 text-success" />;
  if (status === "warning") return <AlertTriangle className="h-4 w-4 text-warning" />;
  return <XCircle className="h-4 w-4 text-destructive" />;
}

export function MarginMonitorSection() {
  const modelsQ = useQuery({ queryKey: ["ai-model-costs-admin"], queryFn: fetchAiModelCostsAdmin });
  const pkgsQ = useQuery({ queryKey: ["ai-credit-packages-admin"], queryFn: fetchAiCreditPackagesAdmin });
  const refQ = useQuery({ queryKey: ["billing-reference-usd-brl"], queryFn: fetchReferenceUsdBrl, staleTime: 300_000 });
  const rateQ = useQuery({
    queryKey: ["usd-brl-rate"],
    queryFn: fetchUsdBrl,
    staleTime: 5 * 60_000,
    refetchInterval: 5 * 60_000,
    refetchIntervalInBackground: true,
  });

  const loading = modelsQ.isLoading || pkgsQ.isLoading || refQ.isLoading || rateQ.isLoading;
  if (loading) return <Skeleton className="h-64 w-full" />;

  const models = modelsQ.data ?? [];
  const packages = (pkgsQ.data ?? []).filter((p) => p.is_active);
  const reference = refQ.data ?? DEFAULT_REFERENCE;
  const usdBrl = rateQ.data ?? reference;
  const variation = ((usdBrl - reference) / reference) * 100;
  const alert = Math.abs(variation) >= ALERT_THRESHOLD_PCT;

  const margins = computeMargins(models, packages, usdBrl);
  const okCount = margins.filter((m) => m.status === "ok").length;
  const warnCount = margins.filter((m) => m.status === "warning").length;
  const dangerCount = margins.filter((m) => m.status === "danger").length;

  return (
    <div className="space-y-4">
      {alert && (
        <div className="flex items-start gap-3 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-medium">Variação cambial acima de 5%!</p>
            <p className="text-xs opacity-90">
              Cotação atual {brl4Fmt.format(usdBrl)} vs referência {brl4Fmt.format(reference)} ({pctFmt(variation)}).
              Considere atualizar preços ou cotação de referência.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-md border border-info/30 bg-info/5 p-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <DollarSign className="h-3 w-3" /> Cotação atual
          </div>
          <div className="mt-1 text-lg font-semibold tabular-nums text-foreground">{brl4Fmt.format(usdBrl)}</div>
          <div className={cn("flex items-center gap-1 text-xs tabular-nums", variation >= 0 ? "text-success" : "text-destructive")}>
            {variation >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {pctFmt(variation)} vs ref.
          </div>
        </div>
        <div className="rounded-md border border-success/30 bg-success/5 p-3">
          <div className="text-xs text-muted-foreground">Modelos OK</div>
          <div className="mt-1 text-lg font-semibold text-success">{okCount}</div>
          <div className="text-xs text-muted-foreground">margem ≥ 100%</div>
        </div>
        <div className="rounded-md border border-warning/30 bg-warning/5 p-3">
          <div className="text-xs text-muted-foreground">Atenção</div>
          <div className="mt-1 text-lg font-semibold text-warning">{warnCount}</div>
          <div className="text-xs text-muted-foreground">0% – 99%</div>
        </div>
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3">
          <div className="text-xs text-muted-foreground">Crítico</div>
          <div className="mt-1 text-lg font-semibold text-destructive">{dangerCount}</div>
          <div className="text-xs text-muted-foreground">margem &lt; 0%</div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[1000px] text-sm">
          <thead>
            <tr className="border-b text-left text-xs uppercase text-muted-foreground">
              <th className="px-2 py-2">Modelo</th>
              <th className="px-2 py-2">Provedor</th>
              <th className="px-2 py-2">Custo API</th>
              <th className="px-2 py-2">Cr/1k</th>
              {packages.map((p) => (
                <th key={p.id} className="px-2 py-2 text-center">{p.name}</th>
              ))}
              <th className="px-2 py-2 text-center">Pior</th>
              <th className="px-2 py-2 text-center">Status</th>
            </tr>
          </thead>
          <tbody>
            {margins.length === 0 && (
              <tr>
                <td colSpan={6 + packages.length} className="px-2 py-6 text-center text-muted-foreground">
                  Nenhum modelo com custo real (USD) configurado.
                </td>
              </tr>
            )}
            {margins.map((m) => (
              <Fragment key={m.model_key}>
                <tr className="border-b">
                  <td className="px-2 py-2">
                    <div className="flex items-center gap-2">
                      <StatusIcon status={m.status} />
                      <span className="font-medium text-foreground">{m.display_name}</span>
                    </div>
                    <span className="ml-6 font-mono text-xs text-muted-foreground">{m.model_key}</span>
                  </td>
                  <td className="px-2 py-2">
                    <Badge variant="outline" className="capitalize">{m.provider}</Badge>
                  </td>
                  <td className="px-2 py-2 tabular-nums">
                    <div className="text-foreground">{usdFmt.format(m.api_cost_usd_1k)}</div>
                    <div className="text-xs text-muted-foreground">{brl4Fmt.format(m.api_cost_brl_1k)} / 1k</div>
                  </td>
                  <td className="px-2 py-2 tabular-nums text-foreground">{brlFmt.format(m.cr_per_1k)}</td>
                  {m.margins_text.map((x, i) => (
                    <td key={i} className="px-2 py-2 text-center">
                      <MarginBadge pct={x.margin_pct} />
                      <div className="mt-0.5 text-[10px] text-muted-foreground tabular-nums">{brl4Fmt.format(x.revenue_brl)}</div>
                    </td>
                  ))}
                  <td className="px-2 py-2 text-center"><MarginBadge pct={m.worst_text} /></td>
                  <td className="px-2 py-2 text-center"><StatusIcon status={m.status} /></td>
                </tr>
                {m.margins_img && m.api_cost_brl_img != null && (
                  <tr className="border-b bg-muted/20">
                    <td className="px-2 py-2 pl-8 text-muted-foreground">🖼️ Imagem</td>
                    <td className="px-2 py-2"></td>
                    <td className="px-2 py-2 tabular-nums">
                      <div className="text-foreground">{m.api_cost_usd_img != null ? usdFmt.format(m.api_cost_usd_img) : "—"}</div>
                      <div className="text-xs text-muted-foreground">{brl4Fmt.format(m.api_cost_brl_img)} / img</div>
                    </td>
                    <td className="px-2 py-2 tabular-nums text-foreground">{m.cr_per_img != null ? brlFmt.format(m.cr_per_img) : "—"}</td>
                    {m.margins_img.map((x, i) => (
                      <td key={i} className="px-2 py-2 text-center">
                        <MarginBadge pct={x.margin_pct} />
                        <div className="mt-0.5 text-[10px] text-muted-foreground tabular-nums">{brl4Fmt.format(x.revenue_brl)}</div>
                      </td>
                    ))}
                    <td className="px-2 py-2 text-center">{m.worst_img != null && <MarginBadge pct={m.worst_img} />}</td>
                    <td className="px-2 py-2"></td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-md border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
        <p className="font-medium text-foreground">Como é calculada a margem</p>
        <p className="mt-1">
          <code>custo_BRL = custo_USD × cotação_ao_vivo</code> ·{" "}
          <code>receita_BRL = créditos × (preço_pacote ÷ total_créditos)</code> ·{" "}
          <code>margem% = (receita − custo) ÷ custo × 100</code>
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span>
            Cotação de referência: <span className="font-medium text-foreground">{brl4Fmt.format(reference)}</span> ·
            atualização ao vivo a cada 5 min via awesomeapi.com.br.
          </span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 px-2 text-xs"
            onClick={() => rateQ.refetch()}
            disabled={rateQ.isFetching}
          >
            <RefreshCw className={cn("mr-1 h-3 w-3", rateQ.isFetching && "animate-spin")} />
            {rateQ.isFetching ? "Atualizando…" : "Atualizar agora"}
          </Button>
          {rateQ.dataUpdatedAt > 0 && (
            <span className="text-foreground/80">
              Última atualização:{" "}
              <span className="font-medium tabular-nums">
                {format(new Date(rateQ.dataUpdatedAt), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
              </span>
            </span>
          )}
          {rateQ.isError && (
            <span className="text-destructive">Falha na consulta — usando fallback.</span>
          )}
        </div>
      </div>
    </div>
  );
}