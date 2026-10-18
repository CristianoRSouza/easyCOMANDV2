"use client";

import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@/shared/http/server-fn";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Ban, CheckCircle2, ShieldAlert, Trash2, User as UserIcon, Users } from "lucide-react";
import { PageHeader } from "@/shared/layout/page-header";
import { DataTable, type Column } from "@/shared/layout/data-table";
import { TablePagination } from "@/shared/layout/table-pagination";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/shared/ui/tooltip";
import { useAuth } from "@/shared/session/auth-provider";
import { manageUsers, type UserRow } from "@/modules/usuarios/infrastructure/users.functions";


const roleTone = (role: string | null) => {
  if (role === "system_admin") return "bg-primary/15 text-primary";
  if (role === "tech_admin") return "bg-primary/15 text-primary";
  if (role === "company_admin") return "bg-warning/15 text-warning";
  return "bg-muted text-muted-foreground";
};

export function UsersPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const run = useServerFn(manageUsers);

  const [pageSize, setPageSize] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const [promoteOpen, setPromoteOpen] = useState(false);
  const [demoteOpen, setDemoteOpen] = useState(false);
  const [activeOpen, setActiveOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [targetRow, setTargetRow] = useState<UserRow | null>(null);
  const [mutLoading, setMutLoading] = useState(false);

  useEffect(() => setCurrentPage(1), [pageSize, debouncedSearch]);

  const listQuery = useQuery({
    queryKey: ["users-list", currentPage, pageSize, debouncedSearch],
    queryFn: () =>
      run({
        data: { action: "list", page: currentPage, pageSize, query: debouncedSearch || undefined } as never,
      }) as Promise<{ rows: UserRow[]; total: number }>,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
  });

  const total = listQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["users-list"] });
  const updateUserStatusInCache = (userId: string, isActive: boolean) => {
    queryClient.setQueriesData<{ rows: UserRow[]; total: number }>(
      { queryKey: ["users-list"] },
      (old) => old ? {
        ...old,
        rows: old.rows.map((row) => row.id === userId ? { ...row, is_active: isActive } : row),
      } : old,
    );
  };

  // Prefetch next page for instant pagination
  useEffect(() => {
    if (currentPage < totalPages) {
      const next = currentPage + 1;
      queryClient.prefetchQuery({
        queryKey: ["users-list", next, pageSize, debouncedSearch],
        queryFn: () =>
          run({
            data: { action: "list", page: next, pageSize, query: debouncedSearch || undefined } as never,
          }) as Promise<{ rows: UserRow[]; total: number }>,
        staleTime: 60_000,
      });
    }
  }, [currentPage, totalPages, pageSize, debouncedSearch, queryClient, run]);

  const openPromote = (r: UserRow) => { setTargetRow(r); setPromoteOpen(true); };
  const openDemote = (r: UserRow) => { setTargetRow(r); setDemoteOpen(true); };
  const openToggleActive = (r: UserRow) => { setTargetRow(r); setActiveOpen(true); };
  const openDelete = (r: UserRow) => { setTargetRow(r); setDeleteConfirm(""); setDeleteOpen(true); };

  const handlePromote = async () => {
    if (!targetRow) return;
    setMutLoading(true);
    try {
      await run({ data: { action: "promote", user_id: targetRow.id } as never });
      toast.success("Usuário promovido a system_admin.");
      setPromoteOpen(false);
      setTargetRow(null);
      invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao promover");
    } finally {
      setMutLoading(false);
    }
  };

  const handleDemote = async () => {
    if (!targetRow) return;
    setMutLoading(true);
    try {
      await run({ data: { action: "demote", user_id: targetRow.id } as never });
      toast.success("Usuário rebaixado para user.");
      setDemoteOpen(false);
      setTargetRow(null);
      invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao rebaixar");
    } finally {
      setMutLoading(false);
    }
  };

  const handleToggleActive = async () => {
    if (!targetRow) return;
    const next = !targetRow.is_active;
    setMutLoading(true);
    try {
      await run({ data: { action: "set_active", user_id: targetRow.id, is_active: next } as never });
      updateUserStatusInCache(targetRow.id, next);
      toast.success(next ? "Usuário ativado." : "Usuário desativado.");
      setActiveOpen(false);
      setTargetRow(null);
      await invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao alterar status");
    } finally {
      setMutLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!targetRow) return;
    setMutLoading(true);
    try {
      await run({ data: { action: "delete", user_id: targetRow.id } as never });
      toast.success("Usuário excluído.");
      setDeleteOpen(false);
      setTargetRow(null);
      setDeleteConfirm("");
      invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao excluir");
    } finally {
      setMutLoading(false);
    }
  };

  const columns: Column<UserRow>[] = useMemo(
    () => [
      {
        key: "user",
        header: "Usuário",
        render: (r) => (
          <div className="flex items-center gap-2">
            <UserIcon className="h-3.5 w-3.5 text-muted-foreground" />
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">{r.email ?? r.id.slice(0, 8) + "…"}</div>
              {r.full_name && (
                <div className="truncate text-[11px] text-muted-foreground">{r.full_name}</div>
              )}
            </div>
          </div>
        ),
      },
      {
        key: "role",
        header: "Role",
        render: (r) => (
          <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${roleTone(r.role)}`}>
            {r.role ?? "—"}
          </span>
        ),
      },
      {
        key: "status",
        header: "Status",
        render: (r) => (
          <span
            className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${
              r.is_active ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"
            }`}
          >
            {r.is_active ? "Ativo" : "Inativo"}
          </span>
        ),
      },
      {
        key: "created",
        header: "Criado em",
        render: (r) => (
          <span className="text-xs text-muted-foreground">
            {r.created_at ? new Date(r.created_at).toLocaleString("pt-BR") : "—"}
          </span>
        ),
      },
      {
        key: "actions",
        header: "",
        className: "text-right",
        render: (r) => {
          const isSelf = user?.id === r.id;
          const isSysAdmin = r.role === "system_admin";
          const roleBtn = isSysAdmin ? (() => {
            const btn = (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-destructive hover:text-destructive"
                disabled={isSelf}
                onClick={() => openDemote(r)}
              >
                <ArrowDown className="mr-1 h-3.5 w-3.5" /> Rebaixar para user
              </Button>
            );
            return isSelf ? (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span tabIndex={0}>{btn}</span>
                  </TooltipTrigger>
                  <TooltipContent>
                    Você não pode rebaixar sua própria conta de system_admin.
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : btn;
          })() : (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-primary hover:text-primary"
              onClick={() => openPromote(r)}
            >
              <ArrowUp className="mr-1 h-3.5 w-3.5" /> Promover
            </Button>
          );

          return (
            <div className="flex flex-wrap justify-end gap-1">
              {roleBtn}
              <Button
                variant="ghost"
                size="sm"
                className={`h-7 px-2 ${r.is_active ? "text-warning hover:text-warning" : "text-success hover:text-success"}`}
                disabled={isSelf && r.is_active}
                onClick={() => openToggleActive(r)}
              >
                {r.is_active ? (
                  <><Ban className="mr-1 h-3.5 w-3.5" /> Desativar</>
                ) : (
                  <><CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Ativar</>
                )}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-destructive hover:text-destructive"
                disabled={isSelf}
                onClick={() => openDelete(r)}
              >
                <Trash2 className="mr-1 h-3.5 w-3.5" /> Excluir
              </Button>
            </div>
          );
        },
      },
    ],
    [user?.id],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Usuários & Roles"
        description="Gerencie quem é system_admin na plataforma. Roles de empresa são geridas no ERP."
        icon={Users}
      />
      <div className="space-y-4 rounded-2xl border border-border bg-card/40 p-5 shadow-[var(--shadow-elegant)] backdrop-blur-sm sm:p-6">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Buscar (e-mail/nome)</Label>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ex.: ana@empresa.com"
              className="h-9"
            />
          </div>
          <div className="flex items-end text-xs text-muted-foreground">
            {total} usuário(s).
          </div>
        </div>

        <DataTable
          rows={listQuery.data?.rows}
          columns={columns}
          loading={listQuery.isLoading}
          empty="Nenhum usuário encontrado."
        />

        <TablePagination
          pageSize={pageSize}
          currentPage={currentPage}
          totalPages={totalPages}
          onPageSizeChange={setPageSize}
          onPageChange={setCurrentPage}
        />
      </div>

      <AlertDialog open={promoteOpen} onOpenChange={setPromoteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-warning" />
              Promover a system_admin?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Você vai promover{" "}
              <strong>{targetRow?.email ?? targetRow?.id}</strong> a{" "}
              <strong>system_admin</strong>.
              <br />
              <br />
              system_admin tem bypass global de RLS e enxerga TODAS as empresas.
              Conceda apenas a operadores da plataforma.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={mutLoading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handlePromote(); }}
              disabled={mutLoading}
            >
              {mutLoading ? "Promovendo…" : "Promover"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={demoteOpen} onOpenChange={setDemoteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rebaixar para user?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{targetRow?.email ?? targetRow?.id}</strong> perderá a role
              system_admin e ficará apenas como <strong>user</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={mutLoading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleDemote(); }}
              disabled={mutLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {mutLoading ? "Rebaixando…" : "Rebaixar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={activeOpen} onOpenChange={setActiveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {targetRow?.is_active ? "Desativar usuário?" : "Ativar usuário?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {targetRow?.is_active ? (
                <>
                  <strong>{targetRow?.email ?? targetRow?.id}</strong> ficará
                  inativo e não poderá acessar o sistema. Os dados são
                  preservados e a ação pode ser revertida.
                </>
              ) : (
                <>
                  <strong>{targetRow?.email ?? targetRow?.id}</strong> voltará
                  a ter acesso ao sistema.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={mutLoading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleToggleActive(); }}
              disabled={mutLoading}
            >
              {mutLoading ? "Salvando…" : (targetRow?.is_active ? "Desativar" : "Ativar")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-4 w-4" />
              Excluir usuário permanentemente?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  Esta ação é <strong>irreversível</strong>. O usuário{" "}
                  <strong>{targetRow?.email ?? targetRow?.id}</strong> será
                  removido da autenticação, do perfil e de todas as roles.
                </p>
                <p>
                  Para confirmar, digite <strong>EXCLUIR</strong> abaixo.
                </p>
                <Input
                  value={deleteConfirm}
                  onChange={(e) => setDeleteConfirm(e.target.value)}
                  placeholder="EXCLUIR"
                  className="h-9"
                  autoFocus
                />
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={mutLoading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleDelete(); }}
              disabled={mutLoading || deleteConfirm !== "EXCLUIR"}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {mutLoading ? "Excluindo…" : "Excluir permanentemente"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
