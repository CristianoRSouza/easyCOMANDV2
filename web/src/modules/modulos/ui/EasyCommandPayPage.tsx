"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/shared/layout/page-header";
import { DataTable, type Column } from "@/shared/layout/data-table";
import { CollapsibleCard } from "@/shared/layout/collapsible-card";
import { TablePagination } from "@/shared/layout/table-pagination";
import { kpisEasyCommandPay, listarAgentes, listarTotens } from "@/modules/modulos/infrastructure/modulos.api";
import { Card, CardContent } from "@/shared/ui/card";
import { Activity, CreditCard, DollarSign, Radio, Server, ShieldCheck } from "lucide-react";



interface TotemRow {
  id: string; totem_name: string | null; is_active: boolean;
  last_heartbeat_at: string | null; heartbeat_machine_id: string | null;
  store_id: string | null; company_id: string | null;
}
interface AgentRow {
  id: string; agent_name: string | null; is_active: boolean;
  contingency_enabled: boolean; sync_service_enabled: boolean;
  store_id: string | null; updated_at: string | null;
}
interface EcpKpis {
  total_totems: number;
  active_totems: number;
  online_totems: number;
  active_agents: number;
  contingency_on: number;
  tx_30d: number;
  tx_24h: number;
  volume_30d: number;
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

function status(lastHb: string | null) {
  if (!lastHb) return { label: "Sem heartbeat", tone: "bg-muted text-muted-foreground" };
  const diff = Date.now() - new Date(lastHb).getTime();
  if (diff < 5 * 60_000) return { label: "Online", tone: "bg-success/15 text-success" };
  if (diff < 60 * 60_000) return { label: "Atrasado", tone: "bg-warning/15 text-warning" };
  return { label: "Offline", tone: "bg-destructive/15 text-destructive" };
}

export function ModuleEasyFoodPayPage() {
  const [totemsPageSize, setTotemsPageSize] = useState(10);
  const [totemsPage, setTotemsPage] = useState(1);
  const [agentsPageSize, setAgentsPageSize] = useState(10);
  const [agentsPage, setAgentsPage] = useState(1);

  const totems = useQuery({
    queryKey: ["health-totems"],
    queryFn: () => listarTotens<TotemRow>(),
  });

  const agents = useQuery({
    queryKey: ["health-agents"],
    queryFn: () => listarAgentes<AgentRow>(),
  });

  const kpiQuery = useQuery({
    queryKey: ["ecp-kpis"],
    queryFn: () => kpisEasyCommandPay<EcpKpis>(),
  });
  const k = kpiQuery.data;
  const kpis = {
    totalTotems: Number(k?.total_totems ?? 0),
    activeTotems: Number(k?.active_totems ?? 0),
    onlineCount: Number(k?.online_totems ?? 0),
    activeAgents: Number(k?.active_agents ?? 0),
    contingencyOn: Number(k?.contingency_on ?? 0),
    tx30d: Number(k?.tx_30d ?? 0),
    tx24h: Number(k?.tx_24h ?? 0),
    volume30d: Number(k?.volume_30d ?? 0),
  };
  const kpisLoading = kpiQuery.isLoading;

  useEffect(() => { setTotemsPage(1); }, [totemsPageSize]);
  useEffect(() => { setAgentsPage(1); }, [agentsPageSize]);

  const totemsTotal = totems.data?.length ?? 0;
  const totemsTotalPages = Math.max(1, Math.ceil(totemsTotal / totemsPageSize));
  const totemsSafePage = Math.min(totemsPage, totemsTotalPages);
  const totemsRows = useMemo(
    () => (totems.data ?? []).slice((totemsSafePage - 1) * totemsPageSize, totemsSafePage * totemsPageSize),
    [totems.data, totemsSafePage, totemsPageSize],
  );

  const agentsTotal = agents.data?.length ?? 0;
  const agentsTotalPages = Math.max(1, Math.ceil(agentsTotal / agentsPageSize));
  const agentsSafePage = Math.min(agentsPage, agentsTotalPages);
  const agentsRows = useMemo(
    () => (agents.data ?? []).slice((agentsSafePage - 1) * agentsPageSize, agentsSafePage * agentsPageSize),
    [agents.data, agentsSafePage, agentsPageSize],
  );

  const totemCols: Column<TotemRow>[] = [
    { key: "name", header: "Totem", render: (r) => <span className="font-medium">{r.totem_name ?? "—"}</span> },
    { key: "machine", header: "Máquina", render: (r) => <span className="font-mono text-xs text-muted-foreground">{r.heartbeat_machine_id ?? "—"}</span> },
    { key: "hb", header: "Último heartbeat", render: (r) => (
      <span className="text-xs text-muted-foreground">
        {r.last_heartbeat_at ? new Date(r.last_heartbeat_at).toLocaleString("pt-BR") : "—"}
      </span>
    )},
    { key: "status", header: "Status", render: (r) => {
      const s = status(r.last_heartbeat_at);
      return <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${s.tone}`}>{s.label}</span>;
    }},
  ];

  const agentCols: Column<AgentRow>[] = [
    { key: "name", header: "Agente", render: (r) => <span className="font-medium">{r.agent_name ?? "—"}</span> },
    { key: "active", header: "Ativo", render: (r) => (
      <span className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium ${r.is_active ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}>
        {r.is_active ? "Sim" : "Não"}
      </span>
    )},
    { key: "cont", header: "Contingência", render: (r) => (
      <span className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium ${r.contingency_enabled ? "bg-warning/15 text-warning" : "bg-muted text-muted-foreground"}`}>
        {r.contingency_enabled ? "Ligada" : "Desligada"}
      </span>
    )},
    { key: "sync", header: "Sync", render: (r) => (
      <span className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium ${r.sync_service_enabled ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}>
        {r.sync_service_enabled ? "Habilitado" : "Desabilitado"}
      </span>
    )},
    { key: "upd", header: "Atualizado", render: (r) => (
      <span className="text-xs text-muted-foreground">{r.updated_at ? new Date(r.updated_at).toLocaleString("pt-BR") : "—"}</span>
    )},
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="EasyFoodPay"
        description="Saúde de Totens (heartbeat) e Agentes NFC-e do módulo EasyFoodPay."
      />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard icon={<Server className="h-4 w-4" />} label="Totens" value={kpis.totalTotems} hint={`${kpis.activeTotems} ativos`} loading={kpisLoading} />
        <KpiCard icon={<Radio className="h-4 w-4" />} label="Totens online" value={kpis.onlineCount} hint="heartbeat < 5min" loading={kpisLoading} tone="success" />
        <KpiCard icon={<ShieldCheck className="h-4 w-4" />} label="Agentes NFC-e ativos" value={kpis.activeAgents} hint={`${kpis.contingencyOn} em contingência`} loading={kpisLoading} />
        <KpiCard icon={<Activity className="h-4 w-4" />} label="Transações 24h" value={kpis.tx24h.toLocaleString("pt-BR")} hint={`${kpis.tx30d.toLocaleString("pt-BR")} nos últimos 30d`} loading={kpisLoading} />
        <KpiCard
          icon={<DollarSign className="h-4 w-4" />}
          label="Volume aprovado (30d)"
          value={kpis.volume30d.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
          hint="status aprovado/pago"
          loading={kpisLoading}
          tone="success"
        />
        <KpiCard
          icon={<CreditCard className="h-4 w-4" />}
          label="Ticket médio (30d)"
          value={(kpis.tx30d > 0 ? kpis.volume30d / kpis.tx30d : 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
          hint="volume / transações"
          loading={kpisLoading}
        />
      </div>
      <CollapsibleCard
        title="Totens"
        description={`${totemsTotal} totem(ns) monitorado(s) — heartbeat < 5min = Online.`}
      >
        <div className="space-y-3">
          <DataTable rows={totemsRows} columns={totemCols} loading={totems.isLoading} />
          <TablePagination
            pageSize={totemsPageSize}
            currentPage={totemsSafePage}
            totalPages={totemsTotalPages}
            onPageSizeChange={setTotemsPageSize}
            onPageChange={setTotemsPage}
          />
        </div>
      </CollapsibleCard>
      <CollapsibleCard
        title="Agentes NFC-e"
        description={`${agentsTotal} agente(s) registrado(s).`}
      >
        <div className="space-y-3">
          <DataTable rows={agentsRows} columns={agentCols} loading={agents.isLoading} />
          <TablePagination
            pageSize={agentsPageSize}
            currentPage={agentsSafePage}
            totalPages={agentsTotalPages}
            onPageSizeChange={setAgentsPageSize}
            onPageChange={setAgentsPage}
          />
        </div>
      </CollapsibleCard>
    </div>
  );
}
