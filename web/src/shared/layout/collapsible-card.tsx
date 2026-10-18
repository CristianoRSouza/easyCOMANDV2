"use client";

import { useState, type ComponentType, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/shared/ui/collapsible";
import { cn } from "@/shared/lib/utils";

export function CollapsibleCard({
  title,
  description,
  badge,
  icon: Icon,
  defaultOpen = false,
  children,
  className,
}: {
  title: string;
  description?: string;
  badge?: ReactNode;
  icon?: ComponentType<{ className?: string }>;
  defaultOpen?: boolean;
  children: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className={cn(
        "group/card overflow-hidden rounded-xl border border-border bg-card text-card-foreground transition-all duration-200",
        open ? "shadow-[var(--shadow-elegant)]" : "shadow-sm hover:border-ring/30",
        className,
      )}
    >
      <CollapsibleTrigger className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition-colors hover:bg-muted/30">
        <div className="flex min-w-0 items-center gap-3">
          {Icon && (
            <div
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-background/50 transition-colors",
                open ? "text-primary" : "text-muted-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
            </div>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="font-display text-sm font-semibold tracking-tight">{title}</h2>
              {badge}
            </div>
            {description && (
              <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
            )}
          </div>
        </div>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200",
            open && "rotate-180 text-primary",
          )}
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
        <div className="border-t border-border bg-background/30 p-5">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  );
}
