"use client";

import { useNavigate } from "@/shared/navigation";
import { useEffect } from "react";
import { toast } from "sonner";
import { ShieldCheck } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/shared/layout/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs";
import { Badge } from "@/shared/ui/badge";
import { RoutePendingFallback } from "@/shared/layout/route-pending";
import { ModulesTab } from "@/modules/rbac/ui/ModulesTab";
import { PermissionsTab } from "@/modules/rbac/ui/PermissionsTab";
import { RolesTab } from "@/modules/rbac/ui/RolesTab";
import { AssignmentsTab } from "@/modules/rbac/ui/AssignmentsTab";
import { AuditTab } from "@/modules/rbac/ui/AuditTab";
import { useAuth } from "@/shared/session/auth-provider";
import { callRbac } from "@/modules/rbac/infrastructure/rbac-client";
import {
  rbacCountDeniedQO,
  rbacModulesQO,
  rbacPermissionsQO,
} from "@/modules/rbac/infrastructure/query-options";


export function RbacPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!loading && user && user.role !== "system_admin") {
      // Best-effort audit log of denied access attempt.
      callRbac({
        action: "log_access_denied",
        path: "/rbac",
        attempted_role: user.role ?? null,
      }).catch(() => {
        // Silent: auditing must not block the redirect UX.
      });
      toast.error("Acesso negado. Gerenciamento de RBAC é restrito ao system_admin.");
      navigate({ to: "/dashboard", replace: true });
    }
  }, [loading, user, navigate]);

  const isAdmin = !loading && !!user && user.role === "system_admin";

  // Prefetch heavy tab data in parallel so switching tabs is instant.
  useEffect(() => {
    if (!isAdmin) return;
    queryClient.prefetchQuery(rbacModulesQO());
    queryClient.prefetchQuery(rbacPermissionsQO());
  }, [isAdmin, queryClient]);

  const { data: deniedCount } = useQuery({
    ...rbacCountDeniedQO(),
    enabled: isAdmin,
    refetchInterval: 30_000,
  });

  if (loading || !user || user.role !== "system_admin") {
    return <RoutePendingFallback />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Gerenciamento de RBAC"
        description="Módulos, permissões, roles, atribuições e auditoria do controle de acesso baseado em funções."
        icon={ShieldCheck}
      />

      <Tabs defaultValue="modules" className="w-full">
        <div className="-mx-3 px-3 sm:mx-0 sm:px-0 overflow-x-auto mb-4">
          <TabsList className="inline-flex w-max sm:w-auto h-auto gap-1 flex-nowrap sm:flex-wrap">
            <TabsTrigger value="modules" className="text-xs sm:text-sm whitespace-nowrap">
              Módulos
            </TabsTrigger>
            <TabsTrigger value="permissions" className="text-xs sm:text-sm whitespace-nowrap">
              Permissões
            </TabsTrigger>
            <TabsTrigger value="roles" className="text-xs sm:text-sm whitespace-nowrap">
              Roles
            </TabsTrigger>
            <TabsTrigger value="assignments" className="text-xs sm:text-sm whitespace-nowrap">
              Atribuições
            </TabsTrigger>
            <TabsTrigger value="audit" className="text-xs sm:text-sm whitespace-nowrap gap-1.5">
              Auditoria
              {(deniedCount?.count ?? 0) > 0 && (
                <Badge variant="destructive" className="h-4 min-w-[18px] px-1 text-[10px] leading-none">
                  {deniedCount!.count}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="modules">
          <ModulesTab />
        </TabsContent>
        <TabsContent value="permissions">
          <PermissionsTab />
        </TabsContent>
        <TabsContent value="roles">
          <RolesTab />
        </TabsContent>
        <TabsContent value="assignments">
          <AssignmentsTab />
        </TabsContent>
        <TabsContent value="audit">
          <AuditTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
