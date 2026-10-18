import { queryOptions } from "@tanstack/react-query";
import type {
  RbacAssignment,
  RbacModule,
  RbacPermission,
  RbacRole,
} from "../domain/types";
import { manageRbac } from "./rbac.functions";

// Shared cache config — keep first-paint instant on re-entry / tab switches.
const SHARED = {
  staleTime: 5 * 60_000, // 5min: data considered fresh
  gcTime: 30 * 60_000, // 30min: keep in cache after unmount
  refetchOnWindowFocus: false,
  refetchOnMount: false, // serve cache first; manual invalidate after mutations
} as const;

// Use the raw server fn (no useServerFn hook needed for prefetch in loaders).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const call = (data: any) => manageRbac({ data });

export const rbacModulesQO = () =>
  queryOptions({
    queryKey: ["rbac", "modules"] as const,
    queryFn: () => call({ action: "list_modules" }) as Promise<RbacModule[]>,
    ...SHARED,
  });

export const rbacPermissionsQO = () =>
  queryOptions({
    queryKey: ["rbac", "permissions"] as const,
    queryFn: () => call({ action: "list_permissions" }) as Promise<RbacPermission[]>,
    ...SHARED,
  });

export const rbacRolesQO = () =>
  queryOptions({
    queryKey: ["rbac", "roles"] as const,
    queryFn: () => call({ action: "list_roles" }) as Promise<RbacRole[]>,
    ...SHARED,
  });

export const rbacCompaniesQO = () =>
  queryOptions({
    queryKey: ["rbac", "companies"] as const,
    queryFn: () =>
      call({ action: "list_companies" }) as Promise<{ id: string; name: string }[]>,
    ...SHARED,
  });

export const rbacAssignmentsQO = (companyId: string) =>
  queryOptions({
    queryKey: ["rbac", "assignments", companyId] as const,
    queryFn: () =>
      call({
        action: "list_user_assignments",
        ...(companyId !== "__all" ? { company_id: companyId } : {}),
      }) as Promise<RbacAssignment[]>,
    ...SHARED,
  });

export const rbacCountDeniedQO = () =>
  queryOptions({
    queryKey: ["rbac", "count_recent_denied"] as const,
    queryFn: () =>
      call({ action: "count_recent_denied" }) as Promise<{ count: number }>,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });