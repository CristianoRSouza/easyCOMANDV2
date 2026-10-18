"use client";

import { PageHeader } from "@/shared/layout/page-header";
import { CollapsibleCard } from "@/shared/layout/collapsible-card";



export function HealthPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Saúde dos Módulos"
        description="Visão consolidada da saúde dos módulos da plataforma."
      />
      <CollapsibleCard
        title="Em construção"
        description="Informações específicas de cada módulo agora estão em Informações por módulo."
      >
        <p className="text-sm text-muted-foreground">Nenhuma informação configurada ainda.</p>
      </CollapsibleCard>
    </div>
  );
}
