"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/shared/layout/page-header";
import { DataTable, type Column } from "@/shared/layout/data-table";
import { CollapsibleCard } from "@/shared/layout/collapsible-card";
import { TablePagination } from "@/shared/layout/table-pagination";
import { listarLicencasDeTotem, listarPlanosDasEmpresas } from "@/modules/billing/infrastructure/licencas.api";
import { Input } from "@/shared/ui/input";



interface LicenseRow {
  id: string; device_type: string | null; device_key: string | null;
  license_type: string | null; status: string | null;
  starts_at: string | null; expires_at: string | null;
  max_transactions_month: number | null;
  store_id: string | null; company_id: string | null;
  created_at: string;
  company_name?: string | null;
}

interface CompanyPlanRow {
  id: string;
  company_id: string;
  company_name: string | null;
  module: string | null;
  plan_name: string | null;
  license_type: string | null;
  is_active: boolean | null;
  max_users: number | null;
  max_stores: number | null;
  starts_at: string | null;
  expires_at: string | null;
  usage_events_30d: number;
  usage_credits_30d: number;
  usage_tokens_30d: number;
}

export function BillingPage() {
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [companyFilter, setCompanyFilter] = useState("");
  const [easymlPageSize, setEasymlPageSize] = useState(10);
  const [easymlPage, setEasymlPage] = useState(1);
  const [easymlFilter, setEasymlFilter] = useState("");
  const [archivePageSize, setArchivePageSize] = useState(10);
  const [archivePage, setArchivePage] = useState(1);
  const [archiveFilter, setArchiveFilter] = useState("");
  const [plansPageSize, setPlansPageSize] = useState(10);
  const [plansPage, setPlansPage] = useState(1);
  const [plansFilter, setPlansFilter] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["totem-licenses"],
    queryFn: () => listarLicencasDeTotem<LicenseRow & { company_name: string | null }>(),
  });

  useEffect(() => {
    setCurrentPage(1);
  }, [pageSize, companyFilter]);

  const filteredData = useMemo(() => {
    const q = companyFilter.trim().toLowerCase();
    if (!q) return data ?? [];
    return (data ?? []).filter((r) =>
      (r.company_name ?? "").toLowerCase().includes(q) ||
      (r.company_id ?? "").toLowerCase().includes(q),
    );
  }, [data, companyFilter]);

  const total = filteredData.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const pageRows = useMemo(
    () => filteredData.slice((safePage - 1) * pageSize, safePage * pageSize),
    [filteredData, safePage, pageSize],
  );

  const tone = (status: string | null) => {
    if (status === "active") return "bg-success/15 text-success";
    if (status === "suspended") return "bg-warning/15 text-warning";
    if (status === "expired" || status === "revoked") return "bg-destructive/15 text-destructive";
    return "bg-muted text-muted-foreground";
  };

  const columns: Column<LicenseRow>[] = [
    { key: "company", header: "Empresa", render: (r) => (
      <span className="text-sm">{r.company_name ?? "—"}</span>
    )},
    { key: "key", header: "Device key", render: (r) => <span className="font-mono text-xs">{r.device_key ?? "—"}</span> },
    { key: "type", header: "Tipo", render: (r) => (
      <span className="text-xs text-muted-foreground">{r.device_type ?? "—"} · {r.license_type ?? "—"}</span>
    )},
    { key: "status", header: "Status", render: (r) => (
      <span className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium ${tone(r.status)}`}>{r.status ?? "—"}</span>
    )},
    { key: "starts", header: "Início", render: (r) => (
      <span className="text-xs text-muted-foreground">{r.starts_at ? new Date(r.starts_at).toLocaleDateString("pt-BR") : "—"}</span>
    )},
    { key: "expires", header: "Expira", render: (r) => (
      <span className="text-xs text-muted-foreground">{r.expires_at ? new Date(r.expires_at).toLocaleDateString("pt-BR") : "—"}</span>
    )},
    { key: "max", header: "Tx/mês", render: (r) => (
      <span className="text-xs text-muted-foreground">{r.max_transactions_month?.toLocaleString("pt-BR") ?? "—"}</span>
    )},
  ];

  const { data: companyPlans, isLoading: loadingPlans } = useQuery({
    queryKey: ["company-plans-usage"],
    queryFn: () => listarPlanosDasEmpresas<CompanyPlanRow>(),
  });

  const allPlans = useMemo(() => {
    const q = plansFilter.trim().toLowerCase();
    if (!q) return companyPlans ?? [];
    return (companyPlans ?? []).filter((p) =>
      (p.company_name ?? "").toLowerCase().includes(q) ||
      (p.company_id ?? "").toLowerCase().includes(q) ||
      (p.module ?? "").toLowerCase().includes(q) ||
      (p.plan_name ?? "").toLowerCase().includes(q),
    );
  }, [companyPlans, plansFilter]);

  const plansTotalPages = Math.max(1, Math.ceil(allPlans.length / plansPageSize));
  const plansSafePage = Math.min(plansPage, plansTotalPages);
  const plansPageRows = useMemo(
    () => allPlans.slice((plansSafePage - 1) * plansPageSize, plansSafePage * plansPageSize),
    [allPlans, plansSafePage, plansPageSize],
  );

  useEffect(() => {
    setPlansPage(1);
  }, [plansPageSize, plansFilter]);

  const matchesModule = (mod: string | null, ...needles: string[]) => {
    const m = (mod ?? "").toLowerCase();
    return needles.some((n) => m.includes(n));
  };

  const easymlPlans = useMemo(() => {
    const q = easymlFilter.trim().toLowerCase();
    return (companyPlans ?? [])
      .filter((p) => matchesModule(p.module, "easyml", "ml"))
      .filter((p) =>
        !q ||
        (p.company_name ?? "").toLowerCase().includes(q) ||
        (p.company_id ?? "").toLowerCase().includes(q),
      );
  }, [companyPlans, easymlFilter]);

  const easymlTotalPages = Math.max(1, Math.ceil(easymlPlans.length / easymlPageSize));
  const easymlSafePage = Math.min(easymlPage, easymlTotalPages);
  const easymlPageRows = useMemo(
    () => easymlPlans.slice((easymlSafePage - 1) * easymlPageSize, easymlSafePage * easymlPageSize),
    [easymlPlans, easymlSafePage, easymlPageSize],
  );

  useEffect(() => {
    setEasymlPage(1);
  }, [easymlPageSize, easymlFilter]);

  const archivePlans = useMemo(() => {
    const q = archiveFilter.trim().toLowerCase();
    return (companyPlans ?? [])
      .filter((p) => matchesModule(p.module, "easyarchive", "archive"))
      .filter((p) =>
        !q ||
        (p.company_name ?? "").toLowerCase().includes(q) ||
        (p.company_id ?? "").toLowerCase().includes(q),
      );
  }, [companyPlans, archiveFilter]);

  const archiveTotalPages = Math.max(1, Math.ceil(archivePlans.length / archivePageSize));
  const archiveSafePage = Math.min(archivePage, archiveTotalPages);
  const archivePageRows = useMemo(
    () => archivePlans.slice((archiveSafePage - 1) * archivePageSize, archiveSafePage * archivePageSize),
    [archivePlans, archiveSafePage, archivePageSize],
  );

  useEffect(() => {
    setArchivePage(1);
  }, [archivePageSize, archiveFilter]);

  const planColumns: Column<CompanyPlanRow>[] = [
    {
      key: "company",
      header: "Empresa",
      render: (r) => (
        <div className="flex flex-col">
          <span className="text-sm font-medium">{r.company_name ?? "—"}</span>
          <span className="font-mono text-[10px] text-muted-foreground">{r.company_id.slice(0, 8)}</span>
        </div>
      ),
    },
    {
      key: "module",
      header: "Módulo",
      render: (r) => <span className="text-xs text-muted-foreground">{r.module ?? "—"}</span>,
    },
    {
      key: "plan",
      header: "Plano",
      render: (r) => (
        <div className="flex flex-col">
          <span className="text-sm">{r.plan_name ?? r.license_type ?? "—"}</span>
          <span className="text-[10px] text-muted-foreground">{r.license_type ?? ""}</span>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (r) => (
        <span
          className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium ${
            r.is_active ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"
          }`}
        >
          {r.is_active ? "ativo" : "inativo"}
        </span>
      ),
    },
    {
      key: "limits",
      header: "Limites",
      render: (r) => (
        <span className="text-xs text-muted-foreground">
          {r.max_users ?? "∞"} usr · {r.max_stores ?? "∞"} lojas
        </span>
      ),
    },
    {
      key: "usage",
      header: "Uso (30d)",
      render: (r) => (
        <div className="flex flex-col text-xs">
          <span>{r.usage_events_30d.toLocaleString("pt-BR")} eventos</span>
          <span className="text-muted-foreground">
            {r.usage_credits_30d.toLocaleString("pt-BR")} créditos · {r.usage_tokens_30d.toLocaleString("pt-BR")} tokens
          </span>
        </div>
      ),
    },
    {
      key: "expires",
      header: "Expira",
      render: (r) => (
        <span className="text-xs text-muted-foreground">
          {r.expires_at ? new Date(r.expires_at).toLocaleDateString("pt-BR") : "—"}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Licenças & Assinaturas"
        description="Licenças e assinaturas das empresas por módulo"
      />
      <CollapsibleCard
        title="Assinaturas por empresa"
        description={`${(companyPlans ?? []).length} licença(s) no total · todos os módulos · uso agregado dos últimos 30 dias.`}
      >
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Input
              value={plansFilter}
              onChange={(e) => setPlansFilter(e.target.value)}
              placeholder="Filtrar por empresa, módulo ou plano…"
              className="max-w-sm"
            />
            {plansFilter && (
              <button
                type="button"
                onClick={() => setPlansFilter("")}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                limpar
              </button>
            )}
          </div>
          <DataTable rows={plansPageRows} columns={planColumns} loading={loadingPlans} />
          <TablePagination
            pageSize={plansPageSize}
            currentPage={plansSafePage}
            totalPages={plansTotalPages}
            onPageSizeChange={setPlansPageSize}
            onPageChange={setPlansPage}
          />
        </div>
      </CollapsibleCard>
      <CollapsibleCard
        title="EasyFoodPay"
        description="Licenças de Totens e dispositivos do módulo EasyFoodPay."
      >
        <div className="space-y-3">
        <CollapsibleCard
          title="Planos de assinatura"
          description={`${(companyPlans ?? []).filter((p) => matchesModule(p.module, "easycommandpay", "totem", "commandpay") && !((p.plan_name ?? "").toLowerCase().includes("demo") || (p.license_type ?? "").toLowerCase().includes("demo"))).length} licença(s) · uso agregado dos últimos 30 dias.`}
        >
          <DataTable
            rows={(companyPlans ?? []).filter((p) => matchesModule(p.module, "easycommandpay", "totem", "commandpay") && !((p.plan_name ?? "").toLowerCase().includes("demo") || (p.license_type ?? "").toLowerCase().includes("demo")))}
            columns={planColumns}
            loading={loadingPlans}
            empty="Nenhuma empresa contratou planos de EasyFoodPay ainda."
          />
        </CollapsibleCard>
        <CollapsibleCard
          title="Licenças de Dispositivos"
          description={`${total} licença(s) provisionada(s).`}
        >
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Input
                value={companyFilter}
                onChange={(e) => setCompanyFilter(e.target.value)}
                placeholder="Filtrar por empresa (nome ou ID)…"
                className="max-w-sm"
              />
              {companyFilter && (
                <button
                  type="button"
                  onClick={() => setCompanyFilter("")}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  limpar
                </button>
              )}
            </div>
            <DataTable rows={pageRows} columns={columns} loading={isLoading} />
            <TablePagination
              pageSize={pageSize}
              currentPage={safePage}
              totalPages={totalPages}
              onPageSizeChange={setPageSize}
              onPageChange={setCurrentPage}
            />
          </div>
        </CollapsibleCard>
        </div>
      </CollapsibleCard>
      <CollapsibleCard
        title="EasyML"
        description="Planos e licenças do módulo EasyML."
      >
        <CollapsibleCard
          title="Planos de assinatura"
          description={`${easymlPlans.length} licença(s) · uso agregado dos últimos 30 dias.`}
        >
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Input
                value={easymlFilter}
                onChange={(e) => setEasymlFilter(e.target.value)}
                placeholder="Filtrar por empresa (nome ou ID)…"
                className="max-w-sm"
              />
              {easymlFilter && (
                <button
                  type="button"
                  onClick={() => setEasymlFilter("")}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  limpar
                </button>
              )}
            </div>
            <DataTable rows={easymlPageRows} columns={planColumns} loading={loadingPlans} empty="Nenhuma empresa contratou planos de EasyML ainda." />
            <TablePagination
              pageSize={easymlPageSize}
              currentPage={easymlSafePage}
              totalPages={easymlTotalPages}
              onPageSizeChange={setEasymlPageSize}
              onPageChange={setEasymlPage}
            />
          </div>
        </CollapsibleCard>
      </CollapsibleCard>
      <CollapsibleCard
        title="EasyArchive"
        description="Planos e licenças do módulo EasyArchive."
      >
        <CollapsibleCard
          title="Planos de assinatura"
          description={`${archivePlans.length} licença(s) · uso agregado dos últimos 30 dias.`}
        >
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Input
                value={archiveFilter}
                onChange={(e) => setArchiveFilter(e.target.value)}
                placeholder="Filtrar por empresa (nome ou ID)…"
                className="max-w-sm"
              />
              {archiveFilter && (
                <button
                  type="button"
                  onClick={() => setArchiveFilter("")}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  limpar
                </button>
              )}
            </div>
            <DataTable rows={archivePageRows} columns={planColumns} loading={loadingPlans} empty="Nenhuma empresa contratou planos de EasyArchive ainda." />
            <TablePagination
              pageSize={archivePageSize}
              currentPage={archiveSafePage}
              totalPages={archiveTotalPages}
              onPageSizeChange={setArchivePageSize}
              onPageChange={setArchivePage}
            />
          </div>
        </CollapsibleCard>
      </CollapsibleCard>
    </div>
  );
}
