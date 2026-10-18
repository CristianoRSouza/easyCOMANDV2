"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@/shared/http/server-fn";
import { Input } from "@/shared/ui/input";
import {
  managePixCredentials,
  type PixCredentialStatus,
} from "@/modules/pix/infrastructure/credentials.functions";
import { usePixStores, type StoreLite } from "@/modules/pix/infrastructure/use-stores";
import {
  listPixWebhookEvents,
  type PixEventRow,
} from "@/modules/pix/infrastructure/events.functions";
import { PixCredentialsDialog } from "@/modules/pix/ui/pix-credentials-dialog";
import { PixEventsTimeline } from "@/modules/pix/ui/pix-events-timeline";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs";
import { StoreCombobox } from "@/modules/pix/ui/store-combobox";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Webhook,
  Search,
  Copy,
  RefreshCw,
  Power,
  Plus,
  Loader2,
  KeyRound,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { toast } from "sonner";
import { PageHeader } from "@/shared/layout/page-header";
import { DataTable, type Column } from "@/shared/layout/data-table";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import {
  PIX_ENVIRONMENTS,
  PIX_TYPES,
  deactivatePixEndpoint,
  listPixEndpoints,
  registerPixEndpoint,
  type PixApiError,
  type PixEndpoint,
  type PixEnvironment,
  type PixType,
} from "@/modules/pix/infrastructure/client";


type Row = PixEndpoint & { store?: StoreLite };

const typeLabel = (t: string) => PIX_TYPES.find((p) => p.value === t)?.label ?? t;
const envLabel = (e: string) => PIX_ENVIRONMENTS.find((p) => p.value === e)?.label ?? e;


export function WebhooksPixPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [envFilter, setEnvFilter] = useState<"all" | PixEnvironment>("all");
  const [stateFilter, setStateFilter] = useState<"all" | "active" | "inactive">("all");

  const [issueOpen, setIssueOpen] = useState(false);
  const [issuedUrl, setIssuedUrl] = useState<string | null>(null);
  const [confirmRotate, setConfirmRotate] = useState<Row | null>(null);
  const [confirmDeactivate, setConfirmDeactivate] = useState<Row | null>(null);
  const [eventsFor, setEventsFor] = useState<Row | null>(null);
  const [credsOpen, setCredsOpen] = useState(false);
  const [credsPrefill, setCredsPrefill] = useState<{
    store_id: string;
    environment: PixEnvironment;
  } | null>(null);

  const storesQuery = usePixStores();
  const endpointsQuery = useQuery({
    queryKey: ["pix-webhooks", "endpoints"],
    queryFn: () => listPixEndpoints(),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const manageCreds = useServerFn(managePixCredentials);
  const credentialsQuery = useQuery({
    queryKey: ["pix-webhooks", "credentials"],
    queryFn: async () => {
      const res = await manageCreds({ data: { action: "list" } });
      return res.credentials;
    },
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const listEvents = useServerFn(listPixWebhookEvents);
  const eventsQuery = useQuery({
    queryKey: ["pix-webhooks", "events"],
    queryFn: async () => listEvents({ data: {} }),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  const rows = useMemo<Row[]>(() => {
    const stores = storesQuery.data;
    const term = search.trim().toLowerCase();
    return (endpointsQuery.data ?? [])
      .map((e) => ({ ...e, store: stores?.get(e.store_id) }))
      .filter((r) => (envFilter === "all" ? true : r.environment === envFilter))
      .filter((r) =>
        stateFilter === "all" ? true : stateFilter === "active" ? r.active : !r.active,
      )
      .filter((r) => {
        if (!term) return true;
        return (
          (r.store?.name ?? "").toLowerCase().includes(term) ||
          (r.store?.cnpj ?? "").toLowerCase().includes(term) ||
          (r.store?.company_name ?? "").toLowerCase().includes(term)
        );
      });
  }, [endpointsQuery.data, storesQuery.data, search, envFilter, stateFilter]);

  const storeLabel = (storeId: string) => {
    const s = storesQuery.data?.get(storeId);
    if (!s) return `loja ${storeId}`;
    return s.cnpj ? `${s.name} (${s.cnpj})` : s.name;
  };

  const registerMutation = useMutation({
    mutationFn: registerPixEndpoint,
    onSuccess: (res) => {
      setIssueOpen(false);
      setConfirmRotate(null);
      setIssuedUrl(res.url);
      void qc.invalidateQueries({ queryKey: ["pix-webhooks", "endpoints"] });
    },
    onError: (err: PixApiError, vars) => {
      const label = storeLabel(vars.store_id);
      const env = envLabel(vars.environment);
      if (err.code === "credentials_not_found" || err.code === "credentials_disabled" || err.code === "credentials_incomplete") {
        const reason =
          err.code === "credentials_not_found"
            ? `A loja ${label} não tem credencial PIXnoPDV cadastrada em ${env}.`
            : err.code === "credentials_disabled"
              ? `A credencial PIXnoPDV da loja ${label} em ${env} está desabilitada.`
              : `A credencial da loja ${label} em ${env} está incompleta (falta usuário/token ou chave secreta).`;
        toast.error(reason, {
          description: "Cadastre as credenciais desta loja para emitir a URL.",
          action: {
            label: "Configurar credenciais",
            onClick: () => {
              setCredsPrefill({ store_id: vars.store_id, environment: vars.environment });
              setCredsOpen(true);
            },
          },
          duration: 12_000,
        });
        return;
      }
      toast.error(err.message);
      if (err.code === "credentials_ambiguous" && err.details?.company_ids?.length) {
        toast.message("Empresas encontradas", { description: err.details.company_ids.join(", ") });
      }
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: deactivatePixEndpoint,
    onSuccess: (res) => {
      setConfirmDeactivate(null);
      toast.success(`${res.desativados} endpoint(s) desativado(s).`);
      void qc.invalidateQueries({ queryKey: ["pix-webhooks", "endpoints"] });
    },
    onError: (err: PixApiError) => toast.error(err.message),
  });

  const columns: Column<Row>[] = [
    {
      key: "store",
      header: "Loja",
      render: (r) => (
        <div>
          <div className="font-medium">{r.store?.name ?? "Loja não encontrada"}</div>
          <div className="font-mono text-[11px] text-muted-foreground">
            {r.store?.cnpj ?? r.store_id}
          </div>
        </div>
      ),
    },
    {
      key: "company",
      header: "Empresa",
      render: (r) => <span className="text-muted-foreground">{r.store?.company_name ?? "—"}</span>,
    },
    {
      key: "env",
      header: "Ambiente",
      render: (r) => (
        <span className="inline-flex items-center rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
          {envLabel(r.environment)}
        </span>
      ),
    },
    { key: "type", header: "Tipo", render: (r) => <span className="text-muted-foreground">{typeLabel(r.pix_type)}</span> },
    {
      key: "state",
      header: "Estado",
      render: (r) => (
        <span
          className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${
            r.active ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"
          }`}
        >
          {r.active ? "Ativo" : "Inativo"}
        </span>
      ),
    },
    {
      key: "last",
      header: "Teste / eventos",
      render: (r) => {
        const s = eventsQuery.data?.summary.find((x) => x.endpoint_id === r.id);
        const lastAt = s?.last_received_at ?? r.last_event_at ?? null;
        const total = s?.total ?? 0;
        return (
          <button
            type="button"
            onClick={() => setEventsFor(r)}
            className={cn(
              "inline-flex flex-col items-start rounded-md px-2 py-0.5 text-xs font-medium transition-colors",
              !lastAt
                ? "bg-muted text-muted-foreground hover:bg-muted/70"
                : "bg-success/15 text-success hover:bg-success/25",
            )}
          >
            <span>{!lastAt ? "Aguardando teste" : "Testado"}</span>
            {lastAt && (
              <span className="font-normal opacity-80">
                há {formatDistanceToNow(new Date(lastAt), { locale: ptBR })}
                {total ? ` · ${total} evento(s)` : ""}
              </span>
            )}
          </button>
        );
      },

    },
    {
      key: "cred",
      header: "Credencial",
      render: (r) => {
        const c = credentialsQuery.data?.find(
          (x) => x.store_id === r.store_id && x.environment === r.environment,
        );
        const ok = c?.enabled && c.has_basic_token && c.has_secret_key && Boolean(c.api_base_url);
        const label = !c
          ? "Não cadastrada"
          : !c.enabled
            ? "Desabilitada"
            : ok
              ? "Configurada"
              : "Incompleta";
        return (
          <button
            type="button"
            onClick={() => {
              setCredsPrefill({ store_id: r.store_id, environment: r.environment });
              setCredsOpen(true);
            }}
            className={cn(
              "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium transition-colors",
              ok
                ? "bg-success/15 text-success hover:bg-success/25"
                : "bg-destructive/15 text-destructive hover:bg-destructive/25",
            )}
          >
            {label}
          </button>
        );
      },
    },
    {
      key: "actions",
      header: "Ações",
      className: "text-right",
      headerClassName: "text-right",
      render: (r) => (
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="outline" onClick={() => setConfirmRotate(r)} disabled={!r.active}>
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            Rotacionar
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-destructive hover:text-destructive"
            onClick={() => setConfirmDeactivate(r)}
            disabled={!r.active}
          >
            <Power className="mr-1.5 h-3.5 w-3.5" />
            Desativar
          </Button>
        </div>
      ),
    },
  ];

  const loadError = endpointsQuery.error as PixApiError | null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Webhooks PIX"
        description="URLs de retorno das transações PIX por loja"
        icon={Webhook}
      actions={
          <>
            <Button
              variant="outline"
              onClick={() => {
                setCredsPrefill(null);
                setCredsOpen(true);
              }}
            >
              <KeyRound className="mr-1.5 h-4 w-4" />
              Credenciais PIXnoPDV
            </Button>
            <Button
              variant="outline"
              disabled={
                endpointsQuery.isFetching ||
                credentialsQuery.isFetching ||
                eventsQuery.isFetching ||
                storesQuery.isFetching
              }
              onClick={() => {
                void Promise.all([
                  endpointsQuery.refetch(),
                  credentialsQuery.refetch(),
                  eventsQuery.refetch(),
                  storesQuery.refetch(),
                ]);
              }}
            >
              <RefreshCw
                className={cn(
                  "mr-1.5 h-4 w-4",
                  (endpointsQuery.isFetching ||
                    credentialsQuery.isFetching ||
                    eventsQuery.isFetching ||
                    storesQuery.isFetching) &&
                    "animate-spin",
                )}
              />
              Atualizar
            </Button>
            <Button onClick={() => setIssueOpen(true)}>
              <Plus className="mr-1.5 h-4 w-4" />
              Emitir URL
            </Button>
          </>
        }
      />

      <Tabs defaultValue="endpoints" className="space-y-4">
        <TabsList>
          <TabsTrigger value="endpoints">Endpoints</TabsTrigger>
          <TabsTrigger value="timeline">Timeline de eventos</TabsTrigger>
        </TabsList>

        <TabsContent value="timeline" className="mt-0">
          <PixEventsTimeline stores={storesQuery.data} />
        </TabsContent>

        <TabsContent value="endpoints" className="mt-0">
      <div className="space-y-4 rounded-2xl border border-border bg-card/40 p-5 shadow-[var(--shadow-elegant)] sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-base font-semibold tracking-tight">Endpoints cadastrados</h2>
            <p className="text-xs text-muted-foreground">{rows.length} endpoint(s).</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-full sm:w-64">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar loja ou CNPJ"
                className="w-full rounded-md border border-input bg-input py-1.5 pl-8 pr-3 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
              />
            </div>
            <Select value={envFilter} onValueChange={(v) => setEnvFilter(v as typeof envFilter)}>
              <SelectTrigger className="w-40"><SelectValue placeholder="Ambiente" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os ambientes</SelectItem>
                {PIX_ENVIRONMENTS.map((e) => (
                  <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={stateFilter} onValueChange={(v) => setStateFilter(v as typeof stateFilter)}>
              <SelectTrigger className="w-36"><SelectValue placeholder="Estado" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="active">Ativos</SelectItem>
                <SelectItem value="inactive">Inativos</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {loadError ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-10 text-center">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <p className="text-sm text-destructive">{loadError.message}</p>
            <Button variant="outline" size="sm" onClick={() => void endpointsQuery.refetch()}>
              Tentar novamente
            </Button>
          </div>
        ) : (
          <DataTable
            rows={rows}
            columns={columns}
            loading={endpointsQuery.isLoading || storesQuery.isLoading}
            empty="Nenhuma loja com webhook configurado."
          />
        )}
      </div>
        </TabsContent>
      </Tabs>

      <IssueDialog
        open={issueOpen}
        onOpenChange={setIssueOpen}
        stores={storesQuery.data}
        credentials={credentialsQuery.data ?? []}
        pending={registerMutation.isPending}
        ambiguousCompanies={
          (registerMutation.error as PixApiError | null)?.code === "credentials_ambiguous"
            ? ((registerMutation.error as PixApiError).details?.company_ids ?? [])
            : []
        }
        onSubmit={(v) => registerMutation.mutate(v)}
      />

      <UrlDialog url={issuedUrl} onClose={() => setIssuedUrl(null)} />

      <PixCredentialsDialog
        open={credsOpen}
        onOpenChange={(o) => {
          setCredsOpen(o);
          if (!o) setCredsPrefill(null);
        }}
        stores={Array.from(storesQuery.data?.values() ?? [])}
        credentials={credentialsQuery.data ?? []}
        prefill={credsPrefill}
        onSaved={() => {
          void qc.invalidateQueries({ queryKey: ["pix-webhooks", "credentials"] });
        }}
      />

      <AlertDialog open={!!confirmRotate} onOpenChange={(o) => !o && setConfirmRotate(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rotacionar URL desta loja?</AlertDialogTitle>
            <AlertDialogDescription>
              A URL atual vai parar de funcionar assim que a nova for cadastrada no painel da
              PIXnoPDV. Até você colar a nova lá, os pagamentos continuam chegando pela antiga.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (!confirmRotate) return;
                registerMutation.mutate({
                  store_id: confirmRotate.store_id,
                  environment: confirmRotate.environment,
                  pix_type: confirmRotate.pix_type,
                });
              }}
            >
              {registerMutation.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              Rotacionar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!confirmDeactivate} onOpenChange={(o) => !o && setConfirmDeactivate(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desativar este webhook?</AlertDialogTitle>
            <AlertDialogDescription>
              Depois disso, qualquer retorno de PIX enviado para essa URL será recusado. Só faça se a
              loja não usa mais PIX ou se você vai cadastrar outra URL.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                if (!confirmDeactivate) return;
                deactivateMutation.mutate({
                  store_id: confirmDeactivate.store_id,
                  environment: confirmDeactivate.environment,
                  pix_type: confirmDeactivate.pix_type,
                });
              }}
            >
              {deactivateMutation.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              Desativar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <EventsDialog
        row={eventsFor}
        onOpenChange={(o) => !o && setEventsFor(null)}
        onRefresh={() => void qc.invalidateQueries({ queryKey: ["pix-webhooks", "events"] })}
      />
    </div>
  );
}

function EventsDialog({
  row,
  onOpenChange,
  onRefresh,
}: {
  row: Row | null;
  onOpenChange: (o: boolean) => void;
  onRefresh: () => void;
}) {
  const listEvents = useServerFn(listPixWebhookEvents);
  const q = useQuery({
    queryKey: ["pix-webhooks", "events", row?.id],
    queryFn: async () => listEvents({ data: { endpoint_id: row!.id } }),
    enabled: Boolean(row),
    staleTime: 15_000,
    refetchOnWindowFocus: false,
  });
  const events: PixEventRow[] = q.data?.events ?? [];

  return (
    <Dialog open={Boolean(row)} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Eventos recebidos</DialogTitle>
          <DialogDescription>
            Callbacks (inclusive os de teste do painel Mediator) recebidos nesta URL.
          </DialogDescription>
        </DialogHeader>


        <div className="max-h-[50vh] overflow-auto rounded-lg border border-border">
          {q.isLoading ? (
            <div className="flex items-center justify-center p-8 text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando…
            </div>
          ) : events.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              Nenhum evento recebido ainda. Use o botão de teste no painel Mediator.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">Recebido</th>
                  <th className="px-3 py-2 text-left">Tipo</th>
                  <th className="px-3 py-2 text-left">TX ID</th>
                  <th className="px-3 py-2 text-right">Valor</th>
                  <th className="px-3 py-2 text-left">Situação</th>
                </tr>
              </thead>
              <tbody>
                {events.map((e) => (
                  <tr key={e.id} className="border-t border-border">
                    <td className="px-3 py-2 text-muted-foreground">
                      {new Date(e.received_at).toLocaleString("pt-BR")}

                    </td>
                    <td className="px-3 py-2">{typeLabel(e.pix_type)}</td>
                    <td className="max-w-[16rem] truncate px-3 py-2 font-mono text-xs text-muted-foreground">
                      {e.tx_id ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {e.valor != null
                        ? e.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
                        : "—"}
                    </td>
                    <td className="px-3 py-2">
                      <span className="text-xs text-muted-foreground">
                        {e.status ?? "—"}
                        {e.outcome ? ` · ${e.outcome}` : ""}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              void q.refetch();
              onRefresh();
            }}
          >
            <RefreshCw className="mr-1.5 h-4 w-4" />
            Atualizar
          </Button>
          <Button onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function IssueDialog({
  open,
  onOpenChange,
  stores,
  credentials,
  pending,
  ambiguousCompanies,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  stores: Map<string, StoreLite> | undefined;
  credentials: PixCredentialStatus[];
  pending: boolean;
  ambiguousCompanies: string[];
  onSubmit: (v: {
    store_id: string;
    environment: PixEnvironment;
    pix_type: PixType;
    company_id?: string;
  }) => void;
}) {
  const [storeId, setStoreId] = useState("");
  const [environment, setEnvironment] = useState<PixEnvironment>("producao");
  const [pixType, setPixType] = useState<PixType>("recebimento");
  const [companyId, setCompanyId] = useState("");

  const [showAll, setShowAll] = useState(false);

  const readyIds = useMemo(() => {
    const set = new Set<string>();
    for (const c of credentials) {
      if (c.environment !== environment) continue;
      if (!c.enabled || !c.has_basic_token || !c.has_secret_key || !c.api_base_url) continue;
      set.add(c.store_id);
    }
    return set;
  }, [credentials, environment]);

  const allStores = useMemo(
    () => Array.from(stores?.values() ?? []).sort((a, b) => a.name.localeCompare(b.name)),
    [stores],
  );
  const storeList = useMemo(
    () => (showAll ? allStores : allStores.filter((s) => readyIds.has(s.id))),
    [allStores, showAll, readyIds],
  );

  useEffect(() => {
    if (storeId && !storeList.some((s) => s.id === storeId)) setStoreId("");
  }, [storeList, storeId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Emitir URL de webhook</DialogTitle>
          <DialogDescription>
            A URL gerada aparece uma única vez e precisa ser cadastrada no painel Mediator.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <label className="text-xs font-medium text-muted-foreground">
                {showAll ? "Loja (todas)" : "Loja (com credencial neste ambiente)"}
              </label>
              <button
                type="button"
                className="text-xs font-medium text-primary hover:underline"
                onClick={() => setShowAll((v) => !v)}
              >
                {showAll ? "Mostrar só com credencial" : "Mostrar todas as lojas"}
              </button>
            </div>
            <StoreCombobox stores={storeList} value={storeId} onChange={setStoreId} />
            {!showAll && storeList.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Nenhuma loja com credencial completa em {envLabel(environment)}. Cadastre em
                Credenciais PIXnoPDV.
              </p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Ambiente</label>
              <Select value={environment} onValueChange={(v) => setEnvironment(v as PixEnvironment)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PIX_ENVIRONMENTS.map((e) => (
                    <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Tipo de PIX</label>
              <Select value={pixType} onValueChange={(v) => setPixType(v as PixType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PIX_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {ambiguousCompanies.length > 0 && (
            <div className="space-y-1.5 rounded-lg border border-border bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground">
                Esta loja aparece em mais de uma empresa. Escolha a empresa correta:
              </p>
              <Select value={companyId} onValueChange={setCompanyId}>
                <SelectTrigger><SelectValue placeholder="Selecione a empresa" /></SelectTrigger>
                <SelectContent>
                  {ambiguousCompanies.map((id) => (
                    <SelectItem key={id} value={id}>{id}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            disabled={!storeId || pending}
            onClick={() =>
              onSubmit({
                store_id: storeId,
                environment,
                pix_type: pixType,
                ...(companyId ? { company_id: companyId } : {}),
              })
            }
          >
            {pending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            Emitir URL
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function UrlDialog({ url, onClose }: { url: string | null; onClose: () => void }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("URL copiada.");
    } catch {
      toast.error("Não foi possível copiar automaticamente. Selecione e copie manualmente.");
    }
  }

  return (
    <Dialog open={!!url} onOpenChange={() => undefined}>
      <DialogContent
        className="max-w-2xl [&>button]:hidden"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>URL gerada</DialogTitle>
          <DialogDescription>
            Esta URL aparece uma única vez. Copie e guarde agora — depois só é possível emitir outra.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-muted/40 p-3">
            <code className="block break-all font-mono text-xs leading-relaxed">{url}</code>
          </div>
          <Button onClick={() => void copy()} className="w-full">
            <Copy className="mr-1.5 h-4 w-4" />
            {copied ? "Copiado" : "Copiar URL"}
          </Button>

          <div className="rounded-lg border border-border bg-card/60 p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Como cadastrar na PIXnoPDV
            </p>
            <ol className="list-decimal space-y-1 pl-4 text-sm text-muted-foreground">
              <li>Abra pixnopdv.com.br/mediator</li>
              <li>Vá em Clientes e selecione a loja</li>
              <li>Abra Cadastro de Clientes → aba Webhooks</li>
              <li>Clique em + WebHook e escolha o tipo</li>
              <li>Cole a URL e salve</li>
            </ol>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              setCopied(false);
              onClose();
            }}
          >
            Já copiei e cadastrei
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
