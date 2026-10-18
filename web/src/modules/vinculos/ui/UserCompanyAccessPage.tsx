"use client";

import { useNavigate } from "@/shared/navigation";
import { useEffect, useMemo, useState } from "react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@/shared/http/server-fn";
import { toast } from "sonner";
import { Building2, CheckCircle, Clock, Plus, ShieldCheck, Trash2, User, XCircle } from "lucide-react";
import { PageHeader } from "@/shared/layout/page-header";
import { DataTable, type Column } from "@/shared/layout/data-table";
import { TablePagination } from "@/shared/layout/table-pagination";
import { RoutePendingFallback } from "@/shared/layout/route-pending";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Badge } from "@/shared/ui/badge";
import { Label } from "@/shared/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
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
import { useAuth } from "@/shared/session/auth-provider";
import { manageUserCompanyAccess, type UcaRow } from "@/modules/vinculos/infrastructure/user-company-access.functions";


type StatusFilter = "all" | "pending" | "approved" | "rejected";

const statusBadge = (status: UcaRow["status"]) => {
  switch (status) {
    case "approved":
      return (
        <Badge className="bg-success/15 text-success hover:bg-success/20">
          <CheckCircle className="mr-1 h-3 w-3" /> Aprovado
        </Badge>
      );
    case "rejected":
      return (
        <Badge variant="destructive">
          <XCircle className="mr-1 h-3 w-3" /> Rejeitado
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className="border-warning/40 text-warning">
          <Clock className="mr-1 h-3 w-3" /> Pendente
        </Badge>
      );
  }
};

export function UserCompanyAccessPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const uca = useServerFn(manageUserCompanyAccess);

  const [pageSize, setPageSize] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [companyFilter, setCompanyFilter] = useState<string>("all");
  const [userQuery, setUserQuery] = useState("");
  const [debouncedUserQuery, setDebouncedUserQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [newUserId, setNewUserId] = useState("");
  const [newCompanyId, setNewCompanyId] = useState("");
  const [newStatus, setNewStatus] = useState<"pending" | "approved" | "rejected">("approved");
  const [userSearch, setUserSearch] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteRow, setDeleteRow] = useState<UcaRow | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    if (!loading && user && user.role !== "system_admin") {
      toast.error("Acesso negado. Esta tela é restrita ao system_admin.");
      navigate({ to: "/dashboard", replace: true });
    }
  }, [loading, user, navigate]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedUserQuery(userQuery), 300);
    return () => clearTimeout(t);
  }, [userQuery]);

  useEffect(() => setCurrentPage(1), [pageSize, statusFilter, companyFilter, debouncedUserQuery]);

  const isAdmin = !!user && user.role === "system_admin";

  const listKey = (page: number) =>
    ["uca-list", page, pageSize, statusFilter, companyFilter, debouncedUserQuery] as const;
  const listFetcher = (page: number) =>
    uca({
      data: {
        action: "list",
        page,
        pageSize,
        status: statusFilter,
        company_id: companyFilter === "all" ? undefined : companyFilter,
        user_query: debouncedUserQuery.trim() || undefined,
      } as never,
    }) as Promise<{ rows: UcaRow[]; total: number }>;

  const listQuery = useQuery({
    queryKey: listKey(currentPage),
    queryFn: () => listFetcher(currentPage),
    enabled: isAdmin,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
  });

  const companiesQuery = useQuery({
    queryKey: ["uca-companies"],
    queryFn: () =>
      uca({ data: { action: "list_companies" } as never }) as Promise<
        { id: string; name: string | null }[]
      >,
    enabled: isAdmin,
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    refetchOnWindowFocus: false,
  });

  const usersQuery = useQuery({
    queryKey: ["uca-users", userSearch],
    queryFn: () =>
      uca({ data: { action: "list_users", query: userSearch } as never }) as Promise<
        { id: string; email: string | null; full_name: string | null }[]
      >,
    enabled: isAdmin && createOpen,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const total = listQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  // Prefetch next page for instant pagination
  useEffect(() => {
    if (!isAdmin) return;
    if (currentPage >= totalPages) return;
    const next = currentPage + 1;
    queryClient.prefetchQuery({
      queryKey: listKey(next),
      queryFn: () => listFetcher(next),
      staleTime: 60_000,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, currentPage, totalPages, pageSize, statusFilter, companyFilter, debouncedUserQuery]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["uca-list"] });

  const handleUpdateStatus = async (row: UcaRow, status: "pending" | "approved" | "rejected") => {
    try {
      await uca({ data: { action: "update_status", id: row.id, status } as never });
      toast.success(status === "approved" ? "Acesso aprovado." : status === "rejected" ? "Acesso revogado." : "Marcado como pendente.");
      invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao atualizar");
    }
  };

  const openDelete = (row: UcaRow) => {
    setDeleteRow(row);
    setDeleteOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteRow) return;
    setDeleteLoading(true);
    try {
      await uca({ data: { action: "delete", id: deleteRow.id } as never });
      toast.success("Vínculo removido.");
      setDeleteOpen(false);
      setDeleteRow(null);
      invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao remover");
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!newUserId || !newCompanyId) {
      toast.error("Selecione usuário e empresa.");
      return;
    }
    try {
      await uca({
        data: { action: "create", user_id: newUserId, company_id: newCompanyId, status: newStatus } as never,
      });
      toast.success("Vínculo criado.");
      setCreateOpen(false);
      setNewUserId("");
      setNewCompanyId("");
      setNewStatus("approved");
      setUserSearch("");
      invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao criar");
    }
  };

  const columns: Column<UcaRow>[] = useMemo(
    () => [
      {
        key: "user",
        header: "Usuário",
        render: (r) => (
          <div className="flex items-center gap-2">
            <User className="h-3.5 w-3.5 text-muted-foreground" />
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">{r.user_email ?? r.user_id.slice(0, 8) + "…"}</div>
              {r.user_full_name && (
                <div className="truncate text-[11px] text-muted-foreground">{r.user_full_name}</div>
              )}
            </div>
          </div>
        ),
      },
      {
        key: "company",
        header: "Empresa",
        render: (r) => (
          <div className="flex items-center gap-2">
            <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-sm">{r.company_name ?? r.company_id.slice(0, 8) + "…"}</span>
          </div>
        ),
      },
      { key: "status", header: "Status", render: (r) => statusBadge(r.status) },
      {
        key: "created",
        header: "Criado em",
        render: (r) => (
          <span className="text-xs text-muted-foreground">
            {new Date(r.created_at).toLocaleString("pt-BR")}
          </span>
        ),
      },
      {
        key: "actions",
        header: "",
        className: "text-right",
        render: (r) => (
          <div className="flex items-center justify-end gap-1">
            {r.status !== "approved" && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-success hover:text-success"
                onClick={() => handleUpdateStatus(r, "approved")}
              >
                <CheckCircle className="mr-1 h-3.5 w-3.5" /> Ativar
              </Button>
            )}
            {r.status !== "rejected" && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-destructive hover:text-destructive"
                onClick={() => handleUpdateStatus(r, "rejected")}
              >
                <XCircle className="mr-1 h-3.5 w-3.5" /> Desativar
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-destructive hover:text-destructive"
              onClick={() => openDelete(r)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ),
      },
    ],
    [],
  );

  if (loading || !user || user.role !== "system_admin") {
    return <RoutePendingFallback />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Acessos Usuário ↔ Empresa"
        description="Vínculos globais entre usuários e empresas (pb_user_company_access)."
        icon={ShieldCheck}
        actions={
          <Button onClick={() => setCreateOpen(true)} size="sm">
            <Plus className="mr-1.5 h-4 w-4" /> Novo vínculo
          </Button>
        }
      />

      <div className="space-y-4 rounded-2xl border border-border bg-card/40 p-5 shadow-[var(--shadow-elegant)] backdrop-blur-sm sm:p-6">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Empresa</Label>
            <Select value={companyFilter} onValueChange={setCompanyFilter}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Todas as empresas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as empresas</SelectItem>
                {(companiesQuery.data ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name ?? c.id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Buscar usuário (e-mail/nome)</Label>
            <Input
              value={userQuery}
              onChange={(e) => setUserQuery(e.target.value)}
              placeholder="ex.: ana@empresa.com"
              className="h-9"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Status</Label>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="approved">Aprovado (ativo)</SelectItem>
                <SelectItem value="pending">Pendente</SelectItem>
                <SelectItem value="rejected">Rejeitado (inativo)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DataTable
          rows={listQuery.data?.rows}
          columns={columns}
          loading={listQuery.isLoading}
          empty="Nenhum vínculo encontrado."
        />

        <TablePagination
          pageSize={pageSize}
          currentPage={currentPage}
          totalPages={totalPages}
          onPageSizeChange={setPageSize}
          onPageChange={setCurrentPage}
        />
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Novo vínculo</DialogTitle>
            <DialogDescription>
              Conceda acesso de um usuário a uma empresa.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Buscar usuário</Label>
              <Input
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="Filtrar por e-mail ou nome…"
                className="h-9"
              />
              <Select value={newUserId} onValueChange={setNewUserId}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Selecione um usuário" />
                </SelectTrigger>
                <SelectContent>
                  {(usersQuery.data ?? []).map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.email ?? u.id} {u.full_name ? `· ${u.full_name}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Empresa</Label>
              <Select value={newCompanyId} onValueChange={setNewCompanyId}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Selecione uma empresa" />
                </SelectTrigger>
                <SelectContent>
                  {(companiesQuery.data ?? []).map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name ?? c.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Status inicial</Label>
              <Select value={newStatus} onValueChange={(v) => setNewStatus(v as typeof newStatus)}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="approved">Aprovado (ativo)</SelectItem>
                  <SelectItem value="pending">Pendente</SelectItem>
                  <SelectItem value="rejected">Rejeitado (inativo)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreate}>Criar vínculo</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover vínculo?</AlertDialogTitle>
            <AlertDialogDescription>
              Você está prestes a remover permanentemente o acesso de{" "}
              <strong>{deleteRow?.user_email ?? deleteRow?.user_id}</strong>
              {" "}à empresa{" "}
              <strong>{deleteRow?.company_name ?? deleteRow?.company_id}</strong>.
              Essa ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteLoading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDeleteConfirm();
              }}
              disabled={deleteLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteLoading ? "Removendo…" : "Remover"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}