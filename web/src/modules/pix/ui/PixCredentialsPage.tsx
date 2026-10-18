"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@/shared/http/server-fn";
import { KeyRound, Plus, Search, Trash2, Pencil, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { PageHeader } from "@/shared/layout/page-header";
import { DataTable, type Column } from "@/shared/layout/data-table";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
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
import { PixCredentialsDialog } from "@/modules/pix/ui/pix-credentials-dialog";
import { usePixStores } from "@/modules/pix/infrastructure/use-stores";
import {
  managePixCredentials,
  type PixCredentialStatus,
} from "@/modules/pix/infrastructure/credentials.functions";
import { PIX_ENVIRONMENTS, type PixEnvironment } from "@/modules/pix/infrastructure/client";


const envLabel = (e: string) => PIX_ENVIRONMENTS.find((p) => p.value === e)?.label ?? e;

type CredRow = Omit<PixCredentialStatus, "id"> & {
  id: string;
  store_name: string;
  store_cnpj: string | null;
  company_name: string | null;
};

export function PixCredentialsPage() {
  const qc = useQueryClient();
  const manage = useServerFn(managePixCredentials);
  const storesQuery = usePixStores();

  const [search, setSearch] = useState("");
  const [envFilter, setEnvFilter] = useState<"all" | PixEnvironment>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [prefill, setPrefill] = useState<{
    store_id: string;
    environment: PixEnvironment;
  } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<CredRow | null>(null);

  const credentialsQuery = useQuery({
    queryKey: ["pix-webhooks", "credentials"],
    queryFn: async () => (await manage({ data: { action: "list" } })).credentials,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const deleteMutation = useMutation({
    mutationFn: async (row: CredRow) =>
      manage({
        data: {
          action: "delete" as const,
          store_id: row.store_id,
          company_id: row.company_id,
          environment: row.environment,
        },
      }),
    onSuccess: () => {
      toast.success("Credencial excluída.");
      setConfirmDelete(null);
      void qc.invalidateQueries({ queryKey: ["pix-webhooks", "credentials"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = useMemo<CredRow[]>(() => {
    const stores = storesQuery.data;
    const term = search.trim().toLowerCase().replace(/[^\w]/g, "");
    return (credentialsQuery.data ?? [])
      .map((c) => {
        const s = stores?.get(c.store_id);
        return {
          ...c,
          id: c.id ?? `${c.store_id}-${c.environment}`,
          store_name: s?.name ?? "Loja não encontrada",
          store_cnpj: s?.cnpj ?? null,
          company_name: s?.company_name ?? null,
        };
      })
      .filter((r) => (envFilter === "all" ? true : r.environment === envFilter))
      .filter((r) => {
        if (!term) return true;
        const hay = [r.store_name, r.store_cnpj, r.company_name, r.basic_user]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .replace(/[^\w]/g, "");
        return hay.includes(term);
      })
      .sort((a, b) => a.store_name.localeCompare(b.store_name));
  }, [credentialsQuery.data, storesQuery.data, search, envFilter]);

  const openEdit = (row: CredRow) => {
    setPrefill({ store_id: row.store_id, environment: row.environment });
    setDialogOpen(true);
  };

  const columns: Column<CredRow>[] = [
    {
      key: "store",
      header: "Loja",
      render: (r) => (
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">{r.store_name}</div>
          <div className="truncate text-[11px] text-muted-foreground">
            {[r.store_cnpj, r.company_name].filter(Boolean).join(" · ") || "—"}
          </div>
        </div>
      ),
    },
    {
      key: "env",
      header: "Ambiente",
      render: (r) => <span className="text-sm">{envLabel(r.environment)}</span>,
    },
    {
      key: "user",
      header: "Usuário (basic)",
      render: (r) => (
        <span className="font-mono text-xs text-muted-foreground">{r.basic_user || "—"}</span>
      ),
    },
    {
      key: "status",
      header: "Situação",
      render: (r) => {
        const ok = r.enabled && r.has_basic_token && r.has_secret_key && Boolean(r.api_base_url);
        const label = !r.enabled
          ? "Desabilitada"
          : ok
            ? "Completa"
            : "Incompleta";
        return (
          <span
            className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium ${
              ok ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"
            }`}
          >
            {label}
          </span>
        );
      },
    },
    {
      key: "updated",
      header: "Atualizada",
      render: (r) =>
        r.updated_at ? (
          <span className="text-xs text-muted-foreground">
            há {formatDistanceToNow(new Date(r.updated_at), { locale: ptBR })}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground/60">—</span>
        ),
    },
    {
      key: "actions",
      header: "Ações",
      className: "text-right",
      render: (r) => (
        <div className="flex justify-end gap-1">
          <Button size="sm" variant="ghost" onClick={() => openEdit(r)}>
            <Pencil className="mr-1.5 h-3.5 w-3.5" />
            Editar
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-destructive hover:text-destructive"
            onClick={() => setConfirmDelete(r)}
          >
            <Trash2 className="mr-1.5 h-3.5 w-3.5" />
            Excluir
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Credenciais PIXnoPDV"
        description="Dados de acesso de cada loja na PIXnoPDV, por ambiente"
        icon={KeyRound}
        actions={
          <Button
            onClick={() => {
              setPrefill(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="mr-1.5 h-4 w-4" />
            Nova credencial
          </Button>
        }
      />

      <div className="space-y-4 rounded-2xl border border-border bg-card/40 p-5 shadow-[var(--shadow-elegant)] sm:p-6">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[16rem] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por loja, CNPJ ou empresa..."
              className="pl-9"
            />
          </div>
          <Select value={envFilter} onValueChange={(v) => setEnvFilter(v as typeof envFilter)}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os ambientes</SelectItem>
              {PIX_ENVIRONMENTS.map((e) => (
                <SelectItem key={e.value} value={e.value}>
                  {e.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {credentialsQuery.isError ? (
          <p className="text-sm text-destructive">
            {(credentialsQuery.error as Error).message}
          </p>
        ) : (
          <DataTable
            rows={rows}
            columns={columns}
            loading={credentialsQuery.isLoading || storesQuery.isLoading}
            empty="Nenhuma credencial cadastrada."
          />
        )}
      </div>

      <PixCredentialsDialog
        open={dialogOpen}
        onOpenChange={(o) => {
          setDialogOpen(o);
          if (!o) setPrefill(null);
        }}
        stores={Array.from(storesQuery.data?.values() ?? [])}
        credentials={credentialsQuery.data ?? []}
        prefill={prefill}
        onSaved={() => {
          void qc.invalidateQueries({ queryKey: ["pix-webhooks", "credentials"] });
        }}
      />

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir credencial?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDelete
                ? `A credencial de ${confirmDelete.store_name} em ${envLabel(confirmDelete.environment)} será removida. A loja deixará de emitir e receber PIX nesse ambiente.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteMutation.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (confirmDelete) deleteMutation.mutate(confirmDelete);
              }}
            >
              {deleteMutation.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
