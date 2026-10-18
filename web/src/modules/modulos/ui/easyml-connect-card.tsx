"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { DataTable, type Column } from "@/shared/layout/data-table";
import { CollapsibleCard } from "@/shared/layout/collapsible-card";
import { TablePagination } from "@/shared/layout/table-pagination";
import { listarConexoesMl, listarPedidosMl, listarUsoDeIa } from "@/modules/modulos/infrastructure/modulos.api";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Slider } from "@/shared/ui/slider";
import { Loader2, Info, Package } from "lucide-react";
import { useToast } from "@/shared/hooks/use-toast";
import {
  fetchBillingConfig,
  updateBillingConfigValue,
  describeBillingError,
  type BillingConfigRow,
} from "@/modules/billing/infrastructure/queries";

interface ConnectionRow {
  id: string;
  external_account_name: string | null;
  external_user_id: string | null;
  status: string | null;
  token_expires_at: string | null;
  last_token_refresh_at: string | null;
  company_id: string | null;
  store_id: string | null;
  updated_at: string | null;
}

interface MlOrderRow {
  id: string;
  ml_order_id: number | string | null;
  buyer_nickname: string | null;
  total_amount: number | string | null;
  currency_id: string | null;
  status: string | null;
  date_created: string | null;
  imported_to_erp: boolean | null;
  store_id: string | null;
}

interface UsageLogRow {
  id: string;
  created_at: string;
  module: string | null;
  function_name: string | null;
  action: string | null;
  model_used: string | null;
  tokens_total: number | null;
  credits_consumed: number | string | null;
  status: string | null;
  duration_ms: number | null;
  was_free: boolean | null;
  platform_display_name?: string | null;
}

const PAGE = 10;

function MarketplacesGlobalCard() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [pct, setPct] = useState(100);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  const { data: row, isLoading } = useQuery({
    queryKey: ["billing-config", "marketplace", "stock_pct_default"],
    queryFn: async (): Promise<BillingConfigRow | null> => {
      const all = await fetchBillingConfig("marketplace");
      return all.find((r) => r.key === "stock_pct_default") ?? null;
    },
  });

  useEffect(() => {
    if (row && typeof row.value?.default === "number") {
      setPct(row.value.default as number);
      setDirty(false);
    }
  }, [row]);

  const exampleTotal = 100;
  const exampleMkt = Math.max(Math.round((exampleTotal * pct) / 100), 0);
  const exampleLoja = exampleTotal - exampleMkt;

  const onSave = async () => {
    if (!row) return;
    setSaving(true);
    try {
      await updateBillingConfigValue(row.id, { ...row.value, default: pct });
      toast({ title: "Configuração salva", description: `Estoque padrão para marketplaces: ${pct}%` });
      setDirty(false);
      qc.invalidateQueries({ queryKey: ["billing-config", "marketplace", "stock_pct_default"] });
    } catch (e) {
      toast({ title: "Falha ao salvar", description: describeBillingError(e), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-2 text-xs text-muted-foreground">
        <Package className="h-4 w-4 text-primary mt-0.5 shrink-0" />
        <p>
          Porcentagem <strong>global</strong> do estoque ERP disponibilizada aos marketplaces.
          Cada empresa pode sobrescrever este padrão na própria plataforma do EasyML Connect.
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : !row ? (
        <p className="text-sm text-muted-foreground">
          Chave <code>marketplace.stock_pct_default</code> não encontrada em <code>billing.config</code>.
        </p>
      ) : (
        <>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Porcentagem global</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  max={100}
                  value={pct}
                  onChange={(e) => {
                    const v = Math.max(1, Math.min(100, Number(e.target.value) || 1));
                    setPct(v);
                    setDirty(true);
                  }}
                  className="h-8 w-20 text-center text-sm tabular-nums"
                />
                <span className="text-sm text-muted-foreground font-medium">%</span>
              </div>
            </div>
            <Slider
              value={[pct]}
              onValueChange={([v]) => { setPct(v); setDirty(true); }}
              min={1}
              max={100}
              step={1}
            />
          </div>

          <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
              <Info className="h-3.5 w-3.5 text-primary" />
              Exemplo com {exampleTotal} unidades no ERP
            </div>
            <div className="flex gap-3">
              <div className="flex-1 rounded-md bg-primary/10 border border-primary/20 p-2.5 text-center">
                <p className="text-lg font-bold text-primary tabular-nums">{exampleMkt}</p>
                <p className="text-[10px] text-muted-foreground">Marketplace</p>
              </div>
              <div className="flex-1 rounded-md bg-muted/50 border p-2.5 text-center">
                <p className="text-lg font-bold text-foreground tabular-nums">{exampleLoja}</p>
                <p className="text-[10px] text-muted-foreground">Reservado (loja)</p>
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Cada empresa/anúncio pode ter sua própria % que sobrescreve este padrão.
            </p>
          </div>

          <div className="flex justify-end">
            <Button size="sm" onClick={onSave} disabled={!dirty || saving}>
              {saving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              Salvar
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

function statusTone(s: string | null) {
  if (!s) return "bg-muted text-muted-foreground";
  if (["active", "paid", "delivered", "success"].includes(s)) return "bg-success/15 text-success";
  if (["pending", "confirmed", "shipped", "payment_in_process"].includes(s)) return "bg-warning/15 text-warning";
  if (["cancelled", "expired", "revoked", "error", "failed"].includes(s)) return "bg-destructive/15 text-destructive";
  return "bg-muted text-muted-foreground";
}

function fmtBRL(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

export function EasyMLConnectCard() {
  const conns = useQuery({
    queryKey: ["connect-connections"],
    queryFn: () => listarConexoesMl<ConnectionRow>(),
  });

  const orders = useQuery({
    queryKey: ["connect-ml-orders"],
    queryFn: () => listarPedidosMl<MlOrderRow>(),
  });

  const usage = useQuery({
    queryKey: ["connect-usage-log"],
    queryFn: () => listarUsoDeIa<UsageLogRow>(),
  });

  const [connsSize, setConnsSize] = useState(PAGE);
  const [connsPage, setConnsPage] = useState(1);
  const [ordersSize, setOrdersSize] = useState(PAGE);
  const [ordersPage, setOrdersPage] = useState(1);
  const [usageSize, setUsageSize] = useState(PAGE);
  const [usagePage, setUsagePage] = useState(1);

  useEffect(() => { setConnsPage(1); }, [connsSize]);
  useEffect(() => { setOrdersPage(1); }, [ordersSize]);
  useEffect(() => { setUsagePage(1); }, [usageSize]);

  const slice = <T,>(data: T[] | undefined, page: number, size: number) =>
    (data ?? []).slice((page - 1) * size, page * size);
  const pages = (total: number, size: number) => Math.max(1, Math.ceil(total / size));

  const connsTotal = conns.data?.length ?? 0;
  const connsPages = pages(connsTotal, connsSize);
  const connsSafe = Math.min(connsPage, connsPages);
  const connsRows = useMemo(() => slice(conns.data, connsSafe, connsSize), [conns.data, connsSafe, connsSize]);

  const ordersTotal = orders.data?.length ?? 0;
  const ordersPages = pages(ordersTotal, ordersSize);
  const ordersSafe = Math.min(ordersPage, ordersPages);
  const ordersRows = useMemo(() => slice(orders.data, ordersSafe, ordersSize), [orders.data, ordersSafe, ordersSize]);

  const usageTotal = usage.data?.length ?? 0;
  const usagePages = pages(usageTotal, usageSize);
  const usageSafe = Math.min(usagePage, usagePages);
  const usageRows = useMemo(() => slice(usage.data, usageSafe, usageSize), [usage.data, usageSafe, usageSize]);

  const connColumns: Column<ConnectionRow>[] = [
    { key: "acct", header: "Conta ML", render: (r) => (
      <div>
        <div className="font-medium">{r.external_account_name ?? "—"}</div>
        <div className="font-mono text-[11px] text-muted-foreground">{r.external_user_id ?? "—"}</div>
      </div>
    )},
    { key: "status", header: "Status", render: (r) => (
      <span className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium ${statusTone(r.status)}`}>{r.status ?? "—"}</span>
    )},
    { key: "exp", header: "Token expira", render: (r) => (
      <span className="text-xs text-muted-foreground">
        {r.token_expires_at ? new Date(r.token_expires_at).toLocaleString("pt-BR") : "—"}
      </span>
    )},
    { key: "ref", header: "Último refresh", render: (r) => (
      <span className="text-xs text-muted-foreground">
        {r.last_token_refresh_at ? new Date(r.last_token_refresh_at).toLocaleString("pt-BR") : "—"}
      </span>
    )},
    { key: "upd", header: "Atualizado", render: (r) => (
      <span className="text-xs text-muted-foreground">{r.updated_at ? new Date(r.updated_at).toLocaleString("pt-BR") : "—"}</span>
    )},
  ];

  const orderColumns: Column<MlOrderRow>[] = [
    { key: "id", header: "ML Order", render: (r) => <span className="font-mono text-xs">{String(r.ml_order_id ?? "—")}</span> },
    { key: "buyer", header: "Comprador", render: (r) => <span className="text-xs text-muted-foreground">{r.buyer_nickname ?? "—"}</span> },
    { key: "total", header: "Total", render: (r) => (
      <span className="text-xs tabular-nums">{r.total_amount != null ? fmtBRL(Number(r.total_amount)) : "—"}</span>
    )},
    { key: "status", header: "Status", render: (r) => (
      <span className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium ${statusTone(r.status)}`}>{r.status ?? "—"}</span>
    )},
    { key: "erp", header: "ERP", render: (r) => (
      <span className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-medium ${r.imported_to_erp ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}>
        {r.imported_to_erp ? "Importado" : "Pendente"}
      </span>
    )},
    { key: "when", header: "Criado em", render: (r) => (
      <span className="text-xs text-muted-foreground whitespace-nowrap">
        {r.date_created ? new Date(r.date_created).toLocaleString("pt-BR") : "—"}
      </span>
    )},
  ];

  const usageColumns: Column<UsageLogRow>[] = [
    { key: "when", header: "Quando", render: (r) => (
      <span className="whitespace-nowrap text-xs text-muted-foreground">
        {new Date(r.created_at).toLocaleString("pt-BR")}
      </span>
    )},
    { key: "platform", header: "Plataforma", render: (r) => (
      <span className="text-xs">{r.platform_display_name ?? r.module ?? "—"}</span>
    )},
    { key: "fn", header: "Função", render: (r) => (
      <span className="font-mono text-[11px]">{r.function_name ?? "—"}</span>
    )},
    { key: "action", header: "Ação", render: (r) => <span className="text-xs">{r.action ?? "—"}</span> },
    { key: "model", header: "Modelo", render: (r) => (
      <span className="text-[11px] text-muted-foreground">{r.model_used ?? "—"}</span>
    )},
    { key: "tokens", header: "Tokens", render: (r) => (
      <span className="text-xs tabular-nums">{r.tokens_total?.toLocaleString("pt-BR") ?? "—"}</span>
    )},
    { key: "credits", header: "Créditos", render: (r) => (
      <span className="text-xs tabular-nums">
        {r.was_free ? "free" : (r.credits_consumed != null ? Number(r.credits_consumed).toFixed(2) : "—")}
      </span>
    )},
    { key: "status", header: "Status", render: (r) => (
      <span className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-medium ${statusTone(r.status)}`}>{r.status ?? "—"}</span>
    )},
    { key: "dur", header: "Duração", render: (r) => (
      <span className="text-xs text-muted-foreground">{r.duration_ms != null ? `${r.duration_ms} ms` : "—"}</span>
    )},
  ];

  return (
    <div className="space-y-4">
      <CollapsibleCard
        title="Marketplaces — Estoque global"
        description="Define a porcentagem padrão do estoque ERP exposta aos marketplaces (Mercado Livre, etc.)."
      >
        <MarketplacesGlobalCard />
      </CollapsibleCard>

      <CollapsibleCard
        title="Conexões"
        description={`${connsTotal} conta(s) ML — limite de 200.`}
      >
        <div className="space-y-3">
          <DataTable rows={connsRows} columns={connColumns} loading={conns.isLoading} />
          <TablePagination
            pageSize={connsSize}
            currentPage={connsSafe}
            totalPages={connsPages}
            onPageSizeChange={setConnsSize}
            onPageChange={setConnsPage}
          />
        </div>
      </CollapsibleCard>

      <CollapsibleCard
        title="Pedidos Mercado Livre"
        description={`${ordersTotal} pedido(s) — últimos 500 importados.`}
      >
        <div className="space-y-3">
          <DataTable rows={ordersRows} columns={orderColumns} loading={orders.isLoading} />
          <TablePagination
            pageSize={ordersSize}
            currentPage={ordersSafe}
            totalPages={ordersPages}
            onPageSizeChange={setOrdersSize}
            onPageChange={setOrdersPage}
          />
        </div>
      </CollapsibleCard>

      <CollapsibleCard
        title="Logs de uso (IA / Billing)"
        description={`${usageTotal} chamada(s) registradas em billing.usage_log_enriched.`}
      >
        <div className="space-y-3">
          <DataTable rows={usageRows} columns={usageColumns} loading={usage.isLoading} />
          <TablePagination
            pageSize={usageSize}
            currentPage={usageSafe}
            totalPages={usagePages}
            onPageSizeChange={setUsageSize}
            onPageChange={setUsagePage}
          />
        </div>
      </CollapsibleCard>
    </div>
  );
}