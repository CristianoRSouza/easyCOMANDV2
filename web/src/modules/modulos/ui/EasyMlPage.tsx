"use client";

import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/shared/layout/page-header";
import { CollapsibleCard } from "@/shared/layout/collapsible-card";
import { Card, CardContent } from "@/shared/ui/card";
import { kpisEasyMl } from "@/modules/modulos/infrastructure/modulos.api";
import { Boxes, DollarSign, Link2, Package, Plug, ShoppingCart, TrendingUp, Upload } from "lucide-react";



interface EasyMlKpis {
  total_conns: number;
  active_conns: number;
  total_links: number;
  active_links: number;
  total_kits: number;
  orders_30d: number;
  orders_24h: number;
  revenue_30d: number;
  imported_30d: number;
}

function fmtBRL(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

function KpiCard({ icon, label, value, hint, loading, tone }: {
  icon: React.ReactNode; label: string; value: React.ReactNode; hint?: string;
  loading?: boolean; tone?: "success" | "warning" | "destructive";
}) {
  const toneCls = tone === "success" ? "text-success" : tone === "warning" ? "text-warning" : tone === "destructive" ? "text-destructive" : "text-foreground";
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {icon}<span>{label}</span>
        </div>
        <div className={`mt-2 text-2xl font-semibold ${toneCls}`}>{loading ? "—" : value}</div>
        {hint && <div className="mt-1 text-[11px] text-muted-foreground">{hint}</div>}
      </CardContent>
    </Card>
  );
}

export function ModuleEasyMLPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["easyml-kpis"],
    queryFn: () => kpisEasyMl<EasyMlKpis>(),
  });

  const k: EasyMlKpis = {
    total_conns: Number(data?.total_conns ?? 0),
    active_conns: Number(data?.active_conns ?? 0),
    total_links: Number(data?.total_links ?? 0),
    active_links: Number(data?.active_links ?? 0),
    total_kits: Number(data?.total_kits ?? 0),
    orders_30d: Number(data?.orders_30d ?? 0),
    orders_24h: Number(data?.orders_24h ?? 0),
    revenue_30d: Number(data?.revenue_30d ?? 0),
    imported_30d: Number(data?.imported_30d ?? 0),
  };
  const importedRate = k.orders_30d > 0 ? (k.imported_30d / k.orders_30d) * 100 : 0;
  const ticket = k.orders_30d > 0 ? k.revenue_30d / k.orders_30d : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="EasyML Connect"
        description="Informações operacionais e métricas do módulo EasyML Connect."
      />

      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        <KpiCard
          icon={<Plug className="h-3.5 w-3.5" />}
          label="Conexões ML"
          value={k.total_conns}
          hint={`${k.active_conns} ativa(s)`}
          loading={isLoading}
        />
        <KpiCard
          icon={<Link2 className="h-3.5 w-3.5" />}
          label="Anúncios vinculados"
          value={k.total_links}
          hint={`${k.active_links} ativos`}
          loading={isLoading}
        />
        <KpiCard
          icon={<Boxes className="h-3.5 w-3.5" />}
          label="Kits"
          value={k.total_kits}
          loading={isLoading}
        />
        <KpiCard
          icon={<Package className="h-3.5 w-3.5" />}
          label="Pedidos (30d)"
          value={k.orders_30d}
          hint={`${k.orders_24h} nas últimas 24h`}
          loading={isLoading}
        />
        <KpiCard
          icon={<ShoppingCart className="h-3.5 w-3.5" />}
          label="Pedidos 24h"
          value={k.orders_24h}
          loading={isLoading}
        />
        <KpiCard
          icon={<DollarSign className="h-3.5 w-3.5" />}
          label="Faturamento aprovado (30d)"
          value={fmtBRL(k.revenue_30d)}
          tone="success"
          loading={isLoading}
        />
        <KpiCard
          icon={<TrendingUp className="h-3.5 w-3.5" />}
          label="Ticket médio (30d)"
          value={fmtBRL(ticket)}
          loading={isLoading}
        />
        <KpiCard
          icon={<Upload className="h-3.5 w-3.5" />}
          label="Pedidos importados ao ERP"
          value={`${importedRate.toFixed(1)}%`}
          hint="dos últimos 30 dias"
          loading={isLoading}
        />
      </div>

      <CollapsibleCard
        title="Sobre os indicadores"
        description="Métricas agregadas do schema connect (conexões, anúncios, kits e pedidos do Mercado Livre)."
      >
        <p className="text-sm text-muted-foreground">
          Os números acima refletem o estado atual de todas as empresas com EasyML Connect ativo.
          {isLoading ? " Carregando dados..." : ""}
        </p>
      </CollapsibleCard>
    </div>
  );
}