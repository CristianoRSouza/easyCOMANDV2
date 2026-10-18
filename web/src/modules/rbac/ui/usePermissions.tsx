"use client";

import { useMemo, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { minhasPermissoes } from "@/modules/rbac/infrastructure/rbac.functions";

export function usePermissions(companyId?: string | null) {
  return useQuery({
    queryKey: ["rbac-permissions", companyId ?? null],
    queryFn: () => minhasPermissoes(companyId),
    staleTime: 5 * 60_000,
  });
}

function matchKey(key: string, perm: string): boolean {
  if (key === "*" || key === perm) return true;
  if (!key.includes("*")) return false;
  const re = new RegExp(
    "^" + key.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") + "$",
  );
  return re.test(perm);
}

export function useCan(perm: string, companyId?: string | null) {
  const { data } = usePermissions(companyId);
  return useMemo(() => {
    if (!data) return false;
    return data.some((k) => matchKey(k, perm));
  }, [data, perm]);
}

export function Can({
  permission,
  companyId,
  fallback = null,
  children,
}: {
  permission: string;
  companyId?: string | null;
  fallback?: ReactNode;
  children: ReactNode;
}) {
  const ok = useCan(permission, companyId);
  return <>{ok ? children : fallback}</>;
}