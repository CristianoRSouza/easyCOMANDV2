"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { Switch } from "@/shared/ui/switch";
import { Label } from "@/shared/ui/label";
import { Badge } from "@/shared/ui/badge";
import { AlertTriangle, FlaskConical, Radio, ShieldCheck, Loader2 } from "lucide-react";
import { useToast } from "@/shared/hooks/use-toast";
import { fetchStripeMode, setStripeMode, type StripeMode } from "@/modules/billing/infrastructure/stripe-invoke";
import { useAuth } from "@/shared/session/auth-provider";

export function StripeModeTab() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [mode, setMode] = useState<StripeMode>("live");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    setLoading(true);
    fetchStripeMode(user.id)
      .then((m) => { if (!cancelled) setMode(m); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [user?.id]);

  const isSandbox = mode === "sandbox";

  const handleToggle = async (checked: boolean) => {
    if (!user?.id) return;
    const next: StripeMode = checked ? "sandbox" : "live";
    setSaving(true);
    try {
      await setStripeMode(user.id, next);
      setMode(next);
      toast({
        title: next === "sandbox" ? "Modo Teste ativado" : "Modo Produção ativado",
        description: next === "sandbox"
          ? "Suas operações de checkout passarão a usar as chaves de teste do Stripe."
          : "Suas operações voltaram a usar as chaves de produção (live).",
      });
    } catch (e) {
      toast({
        title: "Falha ao salvar preferência",
        description: e instanceof Error ? e.message : "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-xs">
        <ShieldCheck className="h-4 w-4 text-primary mt-0.5 shrink-0" />
        <div>
          <p className="font-medium text-foreground">Configuração global por usuário</p>
          <p className="text-muted-foreground">
            Esta preferência fica vinculada à sua conta no Supabase e é replicada simultaneamente para <strong>todas as plataformas</strong> (EasyFoodPay, EasyArchive, PlugSign, EasyML). Ao ligar o modo Teste aqui, todos os módulos passam a usar as chaves sandbox do Stripe ao mesmo tempo. O padrão global é <strong>Produção (Live)</strong>.
          </p>
        </div>
      </div>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                {isSandbox ? <FlaskConical className="h-4 w-4 text-amber-500" /> : <Radio className="h-4 w-4 text-green-500" />}
                Ambiente do Stripe
              </CardTitle>
              <CardDescription className="text-xs">
                Define quais chaves do Stripe (live ou sandbox) o sistema usa nas suas requisições.
              </CardDescription>
            </div>
            {isSandbox
              ? <Badge className="bg-amber-500/15 text-amber-700 border-amber-500/30">Teste (Sandbox)</Badge>
              : <Badge className="bg-green-500/15 text-green-700 border-green-500/30">Produção (Live)</Badge>}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-4 rounded-md border border-border/60 bg-muted/30 px-3 py-3">
            <div className="space-y-0.5">
              <Label htmlFor="stripe-mode-switch" className="text-sm font-medium">Usar chaves de teste do Stripe</Label>
              <p className="text-xs text-muted-foreground">
                Quando ligado, edge functions usam <code>STRIPE_SECRET_KEY</code> (sandbox). Desligado: <code>STRIPE_SECRET_KEY_LIVE</code>.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {(loading || saving) && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
              <Switch
                id="stripe-mode-switch"
                checked={isSandbox}
                onCheckedChange={handleToggle}
                disabled={loading || saving || !user?.id}
              />
            </div>
          </div>
          {isSandbox && (
            <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs">
              <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-foreground">Você está em modo de teste</p>
                <p className="text-muted-foreground">
                  Cobranças não são reais. Use cartões de teste do Stripe (ex.: <code>4242 4242 4242 4242</code>).
                </p>
              </div>
            </div>
          )}
          <div className="text-[11px] text-muted-foreground space-y-1">
            <p><strong>Padrão global:</strong> Produção (Live) para todos os usuários.</p>
            <p><strong>Persistência:</strong> tabela <code>billing.user_stripe_mode</code> (RLS por <code>user_id</code>) — sincronizada entre módulos.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}