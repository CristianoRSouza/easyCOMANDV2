"use client";

import { Construction } from "lucide-react";

export function EmptyModule({ note }: { note?: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-card/40 p-10 text-center">
      <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Construction className="h-5 w-5" />
      </div>
      <h3 className="text-sm font-medium">Módulo aguardando conexão com o Supabase</h3>
      <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">
        {note ??
          "As queries deste módulo serão habilitadas assim que as credenciais do projeto Supabase compartilhado forem configuradas."}
      </p>
    </div>
  );
}
