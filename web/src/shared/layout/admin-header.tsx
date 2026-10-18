"use client";

import { useAuth } from "@/shared/session/auth-provider";
import { useNavigate } from "@/shared/navigation";
import { LogOut } from "lucide-react";
import { AdminBreadcrumbs } from "@/shared/layout/admin-breadcrumbs";
import { Button } from "@/shared/ui/button";
import {
  Avatar,
  AvatarFallback,
} from "@/shared/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";

function initials(name?: string, email?: string) {
  const src = (name && name.trim().length > 0 ? name : email ?? "??").trim();
  const parts = src.split(/[\s@._-]+/).filter(Boolean);
  const a = parts[0]?.[0] ?? "?";
  const b = parts[1]?.[0] ?? parts[0]?.[1] ?? "";
  return (a + b).toUpperCase();
}

export function AdminHeader() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-border bg-background/70 px-4 backdrop-blur-md md:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <AdminBreadcrumbs />
      </div>

      <div className="flex items-center gap-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="group flex items-center gap-3 rounded-full border border-transparent px-1.5 py-1 transition-colors hover:border-border hover:bg-muted/40"
              aria-label="Menu do usuário"
            >
              <div className="hidden text-right leading-tight sm:block">
                <div className="text-sm font-medium">{user?.name ?? "—"}</div>
                <div className="text-[11px] text-muted-foreground">{user?.email}</div>
              </div>
              <Avatar className="h-9 w-9 border border-border">
                <AvatarFallback className="bg-gradient-to-br from-primary to-primary-glow text-xs font-semibold text-primary-foreground">
                  {initials(user?.name, user?.email)}
                </AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="flex flex-col">
              <span className="text-sm">{user?.name ?? "—"}</span>
              <span className="text-[11px] font-normal text-muted-foreground">{user?.email}</span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={async () => {
                await logout();
                navigate({ to: "/login" });
              }}
              className="text-destructive focus:text-destructive"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          variant="ghost"
          size="sm"
          className="md:hidden"
          onClick={async () => {
            await logout();
            navigate({ to: "/login" });
          }}
          aria-label="Sair"
        >
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
