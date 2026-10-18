"use client";

import type { ReactNode } from "react";
import { RequireSystemAdmin } from "@/shared/layout/require-system-admin";
import { AdminSidebar } from "@/shared/layout/admin-sidebar";
import { AdminHeader } from "@/shared/layout/admin-header";

/** O `AdminLayout` de `easyCONTROL/src/routes/_admin.tsx`, com o mesmo JSX. */
export function AdminShell({ children }: { children: ReactNode }) {
  return (
    <RequireSystemAdmin>
      <div className="flex h-screen w-full overflow-hidden bg-background text-foreground">
        <AdminSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <AdminHeader />
          <main className="flex-1 overflow-y-auto">
            <div className="mx-auto w-full max-w-screen-2xl space-y-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
              {children}
            </div>
          </main>
          <footer className="border-t border-border bg-background/50 px-6 py-3 text-center text-[11px] text-muted-foreground backdrop-blur-sm">
            EasySoft Control Center · v0.1.0
          </footer>
        </div>
      </div>
    </RequireSystemAdmin>
  );
}
