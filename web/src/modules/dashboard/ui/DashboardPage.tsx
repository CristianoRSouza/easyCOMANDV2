"use client";

import { PageHeader } from "@/shared/layout/page-header";
import { CollapsibleCard } from "@/shared/layout/collapsible-card";
import { useDashboardKpis } from "@/modules/dashboard/infrastructure/dashboard.queries";
import {
  Building2, Store, MonitorSmartphone, KeyRound, Radio, Activity,
  Plug, Package, Boxes, ShoppingCart, DollarSign, Sparkles,
  LayoutDashboard, Globe2, CreditCard as CreditCardIcon, ScrollText,
} from "lucide-react";
import { Skeleton } from "@/shared/ui/skeleton";
import type { ComponentType } from "react";



const toneClass = {
  primary: "bg-primary/15 text-primary",
  success: "bg-success/15 text-success",
  warning: "bg-warning/15 text-warning",
  destructive: "bg-destructive/15 text-destructive",
} as const;

function Kpi({
  label, value, hint, icon: Icon, tone, loading,
}: {
  label: string; value: string | number; hint: string;
  icon: ComponentType<{ className?: string }>;
  tone: keyof typeof toneClass; loading?: boolean;
}) {
  return (
    <div className="group relative overflow-hidden rounded-xl border border-border bg-card p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-ring/40 hover:shadow-[var(--shadow-elegant)]">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent opacity-0 transition-opacity group-hover:opacity-100"
        aria-hidden
      />
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
          <div className="mt-2 font-display text-3xl font-semibold tabular-nums leading-none">
            {loading ? <Skeleton className="h-8 w-20" /> : value}
          </div>
          <div className="mt-2 text-xs text-muted-foreground">
            {loading ? <Skeleton className="h-3 w-32" /> : hint}
          </div>
        </div>
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${toneClass[tone]} ring-1 ring-inset ring-current/10`}>
          <Icon className="h-4.5 w-4.5" />
        </div>
      </div>
    </div>
  );
}

export function DashboardPage() {
  const { data, isLoading } = useDashboardKpis();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard Global"
        description="Visão consolidada do ecossistema EasySoft."
        icon={LayoutDashboard}
      />
      <CollapsibleCard
        title="Global"
        description="Indicadores transversais do ecossistema EasySoft."
        icon={Globe2}
        defaultOpen
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Kpi label="Empresas" value={data?.companies ?? 0} hint="tenants cadastradas"
            icon={Building2} tone="primary" loading={isLoading} />
          <Kpi label="Lojas ativas" value={data?.stores ?? 0} hint="vinculadas às empresas"
            icon={Store} tone="primary" loading={isLoading} />
        </div>
      </CollapsibleCard>

      <CollapsibleCard
        title="EasyFoodPay"
        description="KPIs do módulo de Totens, Licenças e Agentes NFC-e."
        icon={CreditCardIcon}
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Kpi label="Totens ativos" value={data?.totemsActive ?? 0} hint="device configs ativas"
            icon={MonitorSmartphone} tone="success" loading={isLoading} />
          <Kpi
            label="Totens online"
            value={`${data?.totemsOnline ?? 0} / ${data?.totemsActive ?? 0}`}
            hint="heartbeat < 5 min"
            icon={Radio}
            tone={(data?.totemsOnline ?? 0) > 0 ? "success" : "warning"}
            loading={isLoading}
          />
          <Kpi label="Licenças de totem" value={data?.totemLicenses ?? 0} hint="provisionadas"
            icon={KeyRound} tone="primary" loading={isLoading} />
          <Kpi label="Agentes NFC-e" value={data?.nfceAgents ?? 0} hint="agentes ativos"
            icon={Activity} tone="success" loading={isLoading} />
        </div>
      </CollapsibleCard>

      <CollapsibleCard
        title="EasyML Connect"
        description="KPIs da integração com Mercado Livre (conexões, anúncios, pedidos e IA)."
        icon={Sparkles}
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Kpi label="Conexões ativas" value={data?.mlConnectionsActive ?? 0} hint="contas ML conectadas"
            icon={Plug} tone={(data?.mlConnectionsActive ?? 0) > 0 ? "success" : "warning"} loading={isLoading} />
          <Kpi label="Anúncios vinculados" value={data?.mlProductLinks ?? 0} hint="product_links ativos"
            icon={Package} tone="primary" loading={isLoading} />
          <Kpi label="Kits ativos" value={data?.mlProductKits ?? 0} hint="product_kits não suspensos"
            icon={Boxes} tone="primary" loading={isLoading} />
          <Kpi label="Pedidos (30d)" value={data?.mlOrders30d ?? 0} hint="ml_orders nos últimos 30 dias"
            icon={ShoppingCart} tone="primary" loading={isLoading} />
          <Kpi
            label="Faturamento (30d)"
            value={new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(data?.mlRevenue30d ?? 0)}
            hint="pedidos pagos/enviados/entregues"
            icon={DollarSign}
            tone="success"
            loading={isLoading}
          />
          <Kpi label="Chamadas de IA (30d)" value={data?.mlAiCalls30d ?? 0} hint="billing.usage_log"
            icon={Sparkles} tone="primary" loading={isLoading} />
        </div>
      </CollapsibleCard>

      <CollapsibleCard
        title="Atividade recente"
        description="Eventos registrados em activity_logs nas últimas 24h."
        icon={ScrollText}
      >
        <div className="flex items-baseline gap-2">
          {isLoading ? (
            <>
              <Skeleton className="h-7 w-12" />
              <Skeleton className="h-3 w-56" />
            </>
          ) : (
            <>
              <span className="font-display text-3xl font-semibold tabular-nums">{data?.recentActivity ?? 0}</span>
              <span className="text-xs text-muted-foreground">eventos nas últimas 24h em activity_logs</span>
            </>
          )}
        </div>
      </CollapsibleCard>
    </div>
  );
}
