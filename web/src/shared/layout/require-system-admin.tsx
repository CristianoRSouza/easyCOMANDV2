"use client";

import { Navigate, useLocation } from "@/shared/navigation";
import type { ReactNode } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { useAuth } from "@/shared/session/auth-provider";

export function RequireSystemAdmin({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  // Only show the full-screen splash on the FIRST load, before any user is
  // resolved. Background re-validation (token refresh, tab focus, etc.) must
  // never blank the page when we already have a user in memory.
  if (loading && !user) {
    return (
      <div
        className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background text-muted-foreground"
        style={{ backgroundImage: "var(--gradient-hero)" }}
      >
        <div
          className="flex h-12 w-12 items-center justify-center rounded-xl shadow-[var(--shadow-glow)]"
          style={{ background: "var(--gradient-primary)" }}
        >
          <ShieldCheck className="h-5 w-5 text-primary-foreground" />
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          Verificando credenciais…
        </div>
      </div>
    );
  }

  if (!user || (user.role !== "system_admin" && user.role !== "tech_admin")) {
    return <Navigate to="/login" search={{ redirect: location.pathname }} replace />;
  }

  return <>{children}</>;
}
