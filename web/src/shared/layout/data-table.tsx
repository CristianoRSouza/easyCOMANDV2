"use client";

import type { ReactNode } from "react";
import { Skeleton } from "@/shared/ui/skeleton";
import { cn } from "@/shared/lib/utils";

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  className?: string;
  headerClassName?: string;
}

export function DataTable<T extends { id: string | number }>({
  rows,
  columns,
  loading,
  empty = "Nenhum registro encontrado.",
  skeletonRows = 6,
}: {
  rows: T[] | undefined;
  columns: Column<T>[];
  loading?: boolean;
  empty?: string;
  skeletonRows?: number;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              {columns.map((c) => (
                <th
                  key={c.key}
                  className={cn(
                    "px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground",
                    c.headerClassName ?? c.className,
                  )}
                >
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading &&
              Array.from({ length: skeletonRows }).map((_, i) => (
                <tr key={`sk-${i}`} className="border-b border-border last:border-0">
                  {columns.map((c) => (
                    <td key={c.key} className={cn("px-4 py-3.5 align-middle", c.className)}>
                      <Skeleton className="h-4 w-[70%]" />
                    </td>
                  ))}
                </tr>
              ))}
            {!loading && (!rows || rows.length === 0) && (
              <tr>
                <td colSpan={columns.length} className="px-4 py-12 text-center text-xs text-muted-foreground">
                  {empty}
                </td>
              </tr>
            )}
            {!loading &&
              rows?.map((row, idx) => (
                <tr
                  key={row.id}
                  className={cn(
                    "border-b border-border/60 transition-colors last:border-0",
                    "hover:bg-muted/30",
                    idx % 2 === 1 && "bg-muted/10",
                  )}
                >
                  {columns.map((c) => (
                    <td key={c.key} className={cn("px-4 py-3.5 align-middle", c.className)}>
                      {c.render(row)}
                    </td>
                  ))}
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
