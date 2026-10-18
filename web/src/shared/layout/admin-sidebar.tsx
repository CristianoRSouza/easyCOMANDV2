"use client";

import { Link, useLocation } from "@/shared/navigation";
import { useState } from "react";
import {
  KeyRound,
  LayoutDashboard,
  Building2,
  Store,
  CreditCard,
  Settings2,
  Users,
  ScrollText,
  Activity,
  ShieldCheck,
  Boxes,
  ChevronDown,
  CreditCard as CreditCardIcon,
  Sparkles,
  MessageSquare,
  Shield,
  LayoutList,
  Link2,
  FileSearch,
  Package,
  Webhook,
} from "lucide-react";
import { cn } from "@/shared/lib/utils";

type NavItem = { to: string; label: string; icon: React.ComponentType<{ className?: string }> };

const generalItems: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
];

const tenantItems: NavItem[] = [
  { to: "/companies", label: "Empresas", icon: Building2 },
  { to: "/stores", label: "Lojas", icon: Store },
];

const platformItems: NavItem[] = [
  { to: "/plans", label: "Planos & Preços", icon: Package },
  { to: "/billing", label: "Licenças & Assinaturas", icon: CreditCard },
  { to: "/settings", label: "Configurações Globais", icon: Settings2 },
  { to: "/webhooks-pix", label: "Webhooks PIX", icon: Webhook },
  { to: "/pix-credentials", label: "Credenciais PIXnoPDV", icon: KeyRound },
  { to: "/menus", label: "Gerenciar Menus", icon: LayoutList },
];

const securityItems: NavItem[] = [
  { to: "/users", label: "Usuários & Roles", icon: Users },
  { to: "/rbac", label: "RBAC & Permissões", icon: Shield },
  { to: "/user-company-access", label: "Acessos Usuário ↔ Empresa", icon: Link2 },
  { to: "/permission-audit", label: "Auditoria de Permissões", icon: FileSearch },
];

const observabilityItems: NavItem[] = [
  { to: "/audit", label: "Auditoria", icon: ScrollText },
  { to: "/health", label: "Saúde dos Módulos", icon: Activity },
];

const moduleItems: NavItem[] = [
  { to: "/modules/easycommandpay", label: "EasyFoodPay", icon: CreditCardIcon },
  { to: "/modules/easyml", label: "EasyML Connect", icon: Sparkles },
  { to: "/modules/easychat", label: "EasyChat AI", icon: MessageSquare },
];

function NavLink({ to, label, icon: Icon, active }: NavItem & { active: boolean }) {
  return (
    <Link
      to={to}
      className={cn(
        "group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-all",
        active
          ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-[inset_0_0_0_1px_hsl(var(--sidebar-border))]"
          : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
      )}
    >
      <span
        className={cn(
          "absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r-full bg-primary transition-opacity",
          active ? "opacity-100" : "opacity-0 group-hover:opacity-40",
        )}
      />
      <Icon className={cn("h-4 w-4 shrink-0 transition-colors", active ? "text-primary" : "")} />
      <span className="truncate">{label}</span>
    </Link>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-3 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/70">
      {children}
    </div>
  );
}

export function AdminSidebar() {
  const { pathname } = useLocation();
  const isActive = (to: string) => pathname === to || pathname.startsWith(to + "/");
  const modulesActive = pathname.startsWith("/modules");
  const [modulesOpen, setModulesOpen] = useState(modulesActive);

  return (
    <aside className="hidden md:flex w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      <Link
        to="/dashboard"
        className="flex h-16 items-center gap-3 px-5 border-b border-sidebar-border transition-colors hover:bg-sidebar-accent/40"
      >
        <div
          className="flex h-9 w-9 items-center justify-center rounded-lg shadow-[var(--shadow-glow)]"
          style={{ background: "var(--gradient-primary)" }}
        >
          <ShieldCheck className="h-4.5 w-4.5 text-primary-foreground" />
        </div>
        <div className="flex flex-col leading-tight">
          <span className="font-display text-sm font-semibold tracking-tight">EasySoft</span>
          <span className="text-[11px] text-muted-foreground">Control Center</span>
        </div>
      </Link>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <SectionLabel>Geral</SectionLabel>
        <ul className="space-y-0.5">
          {generalItems.map((it) => (
            <li key={it.to}><NavLink {...it} active={isActive(it.to)} /></li>
          ))}
        </ul>

        <SectionLabel>Tenants</SectionLabel>
        <ul className="space-y-0.5">
          {tenantItems.map((it) => (
            <li key={it.to}><NavLink {...it} active={isActive(it.to)} /></li>
          ))}
        </ul>

        <SectionLabel>Plataforma</SectionLabel>
        <ul className="space-y-0.5">
          {platformItems.map((it) => (
            <li key={it.to}><NavLink {...it} active={isActive(it.to)} /></li>
          ))}
        </ul>

        <SectionLabel>Segurança</SectionLabel>
        <ul className="space-y-0.5">
          {securityItems.map((it) => (
            <li key={it.to}><NavLink {...it} active={isActive(it.to)} /></li>
          ))}
        </ul>

        <SectionLabel>Observabilidade</SectionLabel>
        <ul className="space-y-0.5">
          {observabilityItems.map((it) => (
            <li key={it.to}><NavLink {...it} active={isActive(it.to)} /></li>
          ))}
        </ul>

        <SectionLabel>Módulos</SectionLabel>
        <button
          type="button"
          onClick={() => setModulesOpen((v) => !v)}
          className={cn(
            "group relative flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-all",
            modulesActive
              ? "bg-sidebar-accent text-sidebar-accent-foreground"
              : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
          )}
        >
          <Boxes className="h-4 w-4" />
          <span className="flex-1 text-left">Informações por módulo</span>
          <ChevronDown
            className={cn("h-3.5 w-3.5 transition-transform", modulesOpen && "rotate-180")}
          />
        </button>
        {modulesOpen && (
          <ul className="mt-1 space-y-0.5 border-l border-sidebar-border pl-3 ml-4">
            {moduleItems.map((it) => {
              const active = isActive(it.to);
              return (
                <li key={it.to}>
                  <Link
                    to={it.to}
                    className={cn(
                      "flex items-center gap-2 rounded-md px-3 py-1.5 text-xs transition-colors",
                      active
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                    )}
                  >
                    <it.icon className={cn("h-3.5 w-3.5", active && "text-primary")} />
                    <span>{it.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </nav>

      <div className="border-t border-sidebar-border px-4 py-3">
        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
            Operacional
          </span>
          <span className="font-mono">v0.1.0</span>
        </div>
      </div>
    </aside>
  );
}
