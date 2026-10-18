"use client";

import { Link, useLocation } from "@/shared/navigation";
import { ChevronRight, Home } from "lucide-react";
import { cn } from "@/shared/lib/utils";

const LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  companies: "Empresas",
  stores: "Lojas",
  billing: "Licenças & Assinaturas",
  plans: "Planos & Preços",
  settings: "Configurações Globais",
  "webhooks-pix": "Webhooks PIX",
  "pix-credentials": "Credenciais PIXnoPDV",
  users: "Usuários & Roles",
  audit: "Auditoria",
  health: "Saúde dos Módulos",
  modules: "Módulos",
  easycommandpay: "EasyFoodPay",
  easyml: "EasyML Connect",
  easychat: "EasyChat AI",
  easyarchive: "EasyArchive",
};

function label(seg: string) {
  return LABELS[seg] ?? seg.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function AdminBreadcrumbs() {
  const { pathname } = useLocation();
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length === 0) return null;

  const crumbs = parts.map((seg, i) => ({
    href: "/" + parts.slice(0, i + 1).join("/"),
    label: label(seg),
    last: i === parts.length - 1,
  }));

  return (
    <nav aria-label="Breadcrumb" className="hidden items-center gap-1 text-xs text-muted-foreground md:flex">
      <Link
        to="/dashboard"
        className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 transition-colors hover:bg-muted/50 hover:text-foreground"
        aria-label="Início"
      >
        <Home className="h-3 w-3" />
      </Link>
      {crumbs.map((c) => (
        <span key={c.href} className="flex items-center gap-1">
          <ChevronRight className="h-3 w-3 text-muted-foreground/50" />
          {c.last ? (
            <span className={cn("px-1.5 py-0.5 font-medium text-foreground")}>{c.label}</span>
          ) : (
            <Link
              to={c.href}
              className="rounded-md px-1.5 py-0.5 transition-colors hover:bg-muted/50 hover:text-foreground"
            >
              {c.label}
            </Link>
          )}
        </span>
      ))}
    </nav>
  );
}
