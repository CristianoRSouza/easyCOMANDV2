import type { ReactNode } from "react";
import { AdminShell } from "@/shared/layout/admin-shell";

/** Layout das telas administrativas — o `_admin.tsx` de hoje. */
export default function AdminLayout({ children }: { children: ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
