"use client";

import { Layers } from "lucide-react";
import { PageHeader } from "@/shared/layout/page-header";
import { CollapsibleCard } from "@/shared/layout/collapsible-card";
import { BillingConfigTab } from "@/modules/billing/ui/BillingConfigTab";
import { StripeModeTab } from "@/modules/billing/ui/StripeModeTab";
import { EasyMLConnectCard } from "@/modules/modulos/ui/easyml-connect-card";

export function SettingsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Configurações Globais"
        description="Bases de cálculo (TEF/IA), modo Stripe e integrações herdadas por todos os módulos."
      />
      <CollapsibleCard
        title="Todos os módulos"
        description="Preferências globais aplicadas a todas as plataformas (EasyFoodPay, EasyArchive, PlugSign, EasyML)."
        icon={Layers}
        defaultOpen={true}
      >
        <StripeModeTab />
      </CollapsibleCard>
      <CollapsibleCard
        title="EasyFoodPay"
        description="Bases de cálculo do módulo EasyFoodPay (TEF, IA e taxas)."
        defaultOpen={false}
      >
        <BillingConfigTab />
      </CollapsibleCard>
      <CollapsibleCard
        title="EasyML Connect"
        description="Conexões, pedidos importados e consumo de IA do módulo Mercado Livre."
        defaultOpen={false}
      >
        <EasyMLConnectCard />
      </CollapsibleCard>
    </div>
  );
}
