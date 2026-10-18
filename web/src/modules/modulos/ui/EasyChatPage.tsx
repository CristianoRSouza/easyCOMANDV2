"use client";

import { PageHeader } from "@/shared/layout/page-header";
import { CollapsibleCard } from "@/shared/layout/collapsible-card";



export function ModuleEasyChatPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="EasyChat AI"
        description="Informações operacionais e métricas do módulo EasyChat AI."
      />
      <CollapsibleCard title="Em construção" description="As informações deste módulo serão adicionadas conforme a necessidade.">
        <p className="text-sm text-muted-foreground">Nenhuma informação configurada ainda.</p>
      </CollapsibleCard>
    </div>
  );
}