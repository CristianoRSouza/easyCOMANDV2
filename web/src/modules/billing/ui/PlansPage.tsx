"use client";

import { PageHeader } from "@/shared/layout/page-header";
import { CollapsibleCard } from "@/shared/layout/collapsible-card";
import { BillingPlansAdminTab } from "@/modules/billing/ui/BillingPlansAdminTab";
import { EasyArchivePlansAdminTab } from "@/modules/billing/ui/EasyArchivePlansAdminTab";
import { EasyMLPlansAdminTab } from "@/modules/billing/ui/EasyMLPlansAdminTab";
import { PlugSignPacksAdminTab } from "@/modules/billing/ui/PlugSignPacksAdminTab";
import { StripeSyncPlansButton } from "@/modules/billing/ui/StripeSyncPlansButton";
import { AiCreditsAdminCard } from "@/modules/billing/ui/AiCreditsAdminCard";
import { AiCacheEconomyCard } from "@/modules/billing/ui/AiCacheEconomyCard";

export function PlansPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Planos & Preços"
        description="Catálogo de planos, pacotes e preços de IA comercializados por cada módulo."
        actions={<StripeSyncPlansButton />}
      />
      <CollapsibleCard
        title="EasyFoodPay"
        description="Catálogo de planos do módulo EasyFoodPay."
        defaultOpen={false}
      >
        <BillingPlansAdminTab />
      </CollapsibleCard>
      <CollapsibleCard
        title="EasyArchive"
        description="Planos de assinatura do módulo de gestão documental."
        defaultOpen={false}
      >
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Planos de assinatura</h3>
              <p className="text-xs text-muted-foreground">Mensalidade por usuário do EasyArchive.</p>
            </div>
            <StripeSyncPlansButton module="easyarchive" />
          </div>
          <EasyArchivePlansAdminTab />
        </div>
      </CollapsibleCard>
      <CollapsibleCard
        title="EasyML"
        description="Planos de assinatura do módulo de Mercado Livre (Free, Starter, Pro, Business, Enterprise)."
        defaultOpen={false}
      >
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Catálogo EasyML</h3>
              <p className="text-xs text-muted-foreground">Mensalidade, anúncios incluídos e usuários extras por plano.</p>
            </div>
            <StripeSyncPlansButton module="easyml" />
          </div>
          <EasyMLPlansAdminTab />
        </div>
      </CollapsibleCard>
      <CollapsibleCard
        title="PlugSign"
        description="Pacotes de crédito para assinatura digital (1 crédito = 1 documento assinado)."
        defaultOpen={false}
      >
        <PlugSignPacksAdminTab />
      </CollapsibleCard>
      <AiCreditsAdminCard />
      <CollapsibleCard
        title="Economia de Cache (IA)"
        description="Mede o aproveitamento do prompt caching da OpenAI e a economia em R$ no custo de provedor."
        defaultOpen={false}
      >
        <AiCacheEconomyCard />
      </CollapsibleCard>
    </div>
  );
}