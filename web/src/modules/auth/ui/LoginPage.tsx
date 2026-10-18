"use client";

import { useNavigate } from "@/shared/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { ShieldCheck, Loader2, Mail, Lock, ArrowRight, Boxes, Sparkles, CreditCard } from "lucide-react";
import { useAuth } from "@/shared/session/auth-provider";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";



function FeatureRow({ icon: Icon, title, desc }: { icon: React.ComponentType<{ className?: string }>; title: string; desc: string }) {
  return (
    <li className="flex items-start gap-3">
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-card/60 text-primary">
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <div className="text-sm font-medium text-foreground">{title}</div>
        <div className="text-xs text-muted-foreground">{desc}</div>
      </div>
    </li>
  );
}

export function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (user) navigate({ to: "/dashboard", replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
      navigate({ to: "/dashboard", replace: true });
      return;
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Acesso restrito à equipe técnica EasySoft.",
      );
      setSubmitting(false);
    }
  };

  return (
    <main
      className="relative min-h-screen overflow-hidden bg-background"
      style={{ backgroundImage: "var(--gradient-hero)" }}
    >
      <div className="mx-auto flex min-h-screen max-w-6xl items-center px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid w-full grid-cols-1 overflow-hidden rounded-2xl border border-border bg-card/60 shadow-[var(--shadow-elegant)] backdrop-blur lg:grid-cols-2">
          {/* Brand panel */}
          <aside className="relative hidden flex-col justify-between border-r border-border bg-gradient-to-br from-sidebar to-background p-10 lg:flex">
            <div>
              <div className="flex items-center gap-3">
                <div
                  className="flex h-11 w-11 items-center justify-center rounded-xl shadow-[var(--shadow-glow)]"
                  style={{ background: "var(--gradient-primary)" }}
                >
                  <ShieldCheck className="h-5 w-5 text-primary-foreground" />
                </div>
                <div className="leading-tight">
                  <div className="font-display text-lg font-semibold tracking-tight">EasySoft</div>
                  <div className="text-xs text-muted-foreground">Control Center</div>
                </div>
              </div>

              <h2 className="mt-10 font-display text-3xl font-semibold tracking-tight">
                Centro de controle<br />do ecossistema EasySoft.
              </h2>
              <p className="mt-3 max-w-sm text-sm text-muted-foreground">
                Planos, faturamento, módulos e observabilidade — uma única plataforma para a equipe técnica.
              </p>

              <ul className="mt-10 space-y-4">
                <FeatureRow icon={CreditCard} title="EasyFoodPay" desc="Totens, licenças e agentes NFC-e em tempo real." />
                <FeatureRow icon={Sparkles} title="EasyML Connect" desc="Integração com Mercado Livre e consumo de IA." />
                <FeatureRow icon={Boxes} title="EasyArchive" desc="Catálogo de planos e billing por módulo." />
              </ul>
            </div>
            <p className="text-[11px] text-muted-foreground">
              © {new Date().getFullYear()} EasySoft · uso interno restrito
            </p>
          </aside>

          {/* Form panel */}
          <section className="flex items-center justify-center p-6 sm:p-10">
            <div className="w-full max-w-sm">
              <div className="mb-8 flex items-center justify-center gap-2 lg:hidden">
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-lg"
                  style={{ background: "var(--gradient-primary)" }}
                >
                  <ShieldCheck className="h-5 w-5 text-primary-foreground" />
                </div>
                <div className="leading-tight">
                  <div className="font-display text-base font-semibold">EasySoft</div>
                  <div className="text-[11px] text-muted-foreground">Control Center</div>
                </div>
              </div>

              <h1 className="font-display text-2xl font-semibold tracking-tight">Bem-vindo de volta</h1>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Acesso restrito a usuários com role{" "}
                <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">system_admin</code>{" "}
                ou{" "}
                <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">tech_admin</code>.
              </p>

              <form onSubmit={onSubmit} className="mt-7 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">E-mail</label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="h-11 pl-9"
                      placeholder="voce@easysoft.com"
                      autoComplete="email"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Senha</label>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="h-11 pl-9"
                      autoComplete="current-password"
                      placeholder="••••••••"
                    />
                  </div>
                </div>

                {error && (
                  <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                    {error}
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={submitting}
                  aria-busy={submitting}
                  className="h-11 w-full text-sm font-semibold shadow-[var(--shadow-glow)]"
                  style={{ background: "var(--gradient-primary)", color: "hsl(var(--primary-foreground))" }}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Entrando…
                    </>
                  ) : (
                    <>
                      Entrar
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </Button>
              </form>

              <p className="mt-8 text-center text-[11px] text-muted-foreground lg:hidden">
                © {new Date().getFullYear()} EasySoft · uso interno
              </p>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
