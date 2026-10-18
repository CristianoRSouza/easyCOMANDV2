"use client";

import { useEffect, useRef, useState } from "react";
import { ExternalLink, Loader2, RefreshCcw } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { useToast } from "@/shared/hooks/use-toast";
import { invokeStripeSyncPlans } from "@/modules/billing/infrastructure/stripe-sync.functions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { Badge } from "@/shared/ui/badge";
import { ScrollArea } from "@/shared/ui/scroll-area";

type SyncStatus = "created" | "updated" | "skipped" | "failed" | "synced";

interface SyncItem {
  name: string;
  tier?: string | null;
  slug?: string | null;
  status: SyncStatus;
  message?: string;
}

interface SyncSummary {
  mode: "test" | "live" | "test+live";
  items: SyncItem[];
  totals: Record<SyncStatus, number>;
  rawMessage?: string;
}

function normalizeStatus(v: unknown): SyncStatus {
  const s = String(v ?? "").toLowerCase();
  if (s.includes("creat")) return "created";
  if (s.includes("updat")) return "updated";
  if (s.includes("skip") || s.includes("ignor") || s.includes("noop") || s.includes("unchanged")) return "skipped";
  if (s.includes("fail") || s.includes("error")) return "failed";
  return "synced";
}

function asString(v: unknown): string | undefined {
  return typeof v === "string" && v.trim().length > 0 ? v : undefined;
}

function buildSummary(data: unknown, mode: "test" | "live"): SyncSummary {
  const r = (data ?? {}) as Record<string, unknown>;
  const rawList = Array.isArray(r.results)
    ? (r.results as unknown[])
    : Array.isArray(r.plans)
      ? (r.plans as unknown[])
      : Array.isArray(r.items)
        ? (r.items as unknown[])
        : [];

  const items: SyncItem[] = rawList.map((row) => {
    const o = (row ?? {}) as Record<string, unknown>;
    const name =
      asString(o.name) ??
      asString(o.plan_name) ??
      asString((o.plan as Record<string, unknown> | undefined)?.name) ??
      asString(o.slug) ??
      "(sem nome)";
    const tier =
      asString(o.tier) ??
      asString(o.plan_tier) ??
      asString((o.plan as Record<string, unknown> | undefined)?.tier);
    const slug =
      asString(o.slug) ??
      asString((o.plan as Record<string, unknown> | undefined)?.slug);
    const status = normalizeStatus(o.status ?? o.action ?? o.result);
    const message = asString(o.message) ?? asString(o.error);
    return { name, tier, slug, status, message };
  });

  const totals: Record<SyncStatus, number> = {
    created: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
    synced: 0,
  };
  for (const it of items) totals[it.status] += 1;

  // Fallbacks from top-level counters when the array is empty/missing.
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
  if (items.length === 0) {
    totals.created = num(r.created);
    totals.updated = num(r.updated);
    totals.skipped = num(r.skipped);
    totals.failed = num(r.failed);
    totals.synced = num(r.synced);
  }

  return { mode, items, totals, rawMessage: asString(r.message) };
}

const STATUS_LABEL: Record<SyncStatus, string> = {
  created: "Criado",
  updated: "Atualizado",
  skipped: "Ignorado",
  failed: "Erro",
  synced: "Sincronizado",
};

function StatusBadge({ status }: { status: SyncStatus }) {
  const variant: "default" | "secondary" | "destructive" | "outline" =
    status === "failed"
      ? "destructive"
      : status === "created"
        ? "default"
        : status === "updated"
          ? "secondary"
          : "outline";
  return <Badge variant={variant}>{STATUS_LABEL[status]}</Badge>;
}

/**
 * Aciona a edge function `stripe-sync-plans` para criar/atualizar os
 * products/prices no Stripe e gravar os IDs em `billing.module_plans`.
 * Respeita o modo Stripe atual do usuário (sandbox/live).
 * Serve para todos os módulos (EasyFoodPay, EasyML, EasyArchive, ...).
 */
type LogLevel = "info" | "success" | "warn" | "error";
interface LogEntry {
  ts: number; // ms since run start
  level: LogLevel;
  text: string;
}

function fmtElapsed(ms: number) {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

const LEVEL_COLOR: Record<LogLevel, string> = {
  info: "text-muted-foreground",
  success: "text-emerald-500",
  warn: "text-amber-500",
  error: "text-destructive",
};

export function StripeSyncPlansButton({
  module,
  size = "sm",
  variant = "outline",
}: {
  /** Opcional: filtra a sincronização por módulo. Omita para sincronizar todos. */
  module?: string;
  size?: "sm" | "default" | "lg";
  variant?: "default" | "outline" | "secondary" | "ghost";
}) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<SyncSummary | null>(null);
  const [open, setOpen] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef<number>(0);
  const logBottomRef = useRef<HTMLDivElement | null>(null);

  const pushLog = (level: LogLevel, text: string) => {
    setLogs((prev) => [...prev, { ts: Date.now() - startRef.current, level, text }]);
  };

  // Live elapsed timer while loading.
  useEffect(() => {
    if (!loading) return;
    const id = window.setInterval(() => {
      setElapsed(Date.now() - startRef.current);
    }, 100);
    return () => window.clearInterval(id);
  }, [loading]);

  // Autoscroll log panel.
  useEffect(() => {
    logBottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [logs.length]);

  const handleClick = async () => {
    const modes: Array<"test" | "live"> = ["test", "live"];
    startRef.current = Date.now();
    setLogs([]);
    setSummary(null);
    setElapsed(0);
    setOpen(true);
    setLoading(true);
    pushLog("info", `Iniciando sincronização nos dois ambientes (Teste + Produção)${module ? ` · módulo ${module}` : " · todos os módulos"}`);
    const combined: SyncSummary = {
      mode: "test+live",
      items: [],
      totals: { created: 0, updated: 0, skipped: 0, failed: 0, synced: 0 },
    };
    try {
      for (const mode of modes) {
        const label = mode === "test" ? "Teste (sandbox)" : "Produção (live)";
        pushLog("info", `→ Sincronizando ambiente ${label}...`);
        const body: Record<string, unknown> = { mode };
        if (module) body.module = module;

        const { data, error } = await invokeStripeSyncPlans(body as { mode: "test" | "live"; module?: string });
        if (error) {
          pushLog("error", `Falha no ambiente ${label}: ${error.message ?? "erro desconhecido"}`);
          continue;
        }

        const s = buildSummary(data, mode);
        pushLog("success", `Resposta de ${label} recebida (${fmtElapsed(Date.now() - startRef.current)}).`);

        if (s.items.length > 0) {
          for (let i = 0; i < s.items.length; i++) {
            const it = s.items[i];
            await new Promise((r) => setTimeout(r, 40));
            const lvl: LogLevel =
              it.status === "failed" ? "error" : it.status === "skipped" ? "warn" : "success";
            const ident = [it.name, it.tier].filter(Boolean).join(" · ");
            pushLog(lvl, `[${label}] [${i + 1}/${s.items.length}] ${ident} — ${STATUS_LABEL[it.status]}${it.message ? ` (${it.message})` : ""}`);
            combined.items.push({ ...it, name: `[${mode}] ${it.name}` });
          }
        } else if (s.rawMessage) {
          pushLog("info", `[${label}] ${s.rawMessage}`);
        }

        (Object.keys(combined.totals) as SyncStatus[]).forEach((k) => {
          combined.totals[k] += s.totals[k];
        });
      }

      const totalsLine = (["created", "updated", "skipped", "failed"] as SyncStatus[])
        .map((k) => `${STATUS_LABEL[k]}: ${combined.totals[k]}`)
        .join(" · ");
      pushLog("success", `Concluído em ${fmtElapsed(Date.now() - startRef.current)} — ${totalsLine}`);
      setSummary(combined);

      const parts: string[] = [];
      if (combined.totals.created) parts.push(`${combined.totals.created} criado(s)`);
      if (combined.totals.updated) parts.push(`${combined.totals.updated} atualizado(s)`);
      if (combined.totals.skipped) parts.push(`${combined.totals.skipped} ignorado(s)`);
      if (combined.totals.failed) parts.push(`${combined.totals.failed} com erro`);
      toast({
        title: "Planos sincronizados (Teste + Produção)",
        description:
          parts.length > 0
            ? parts.join(" · ")
            : "Nenhuma alteração necessária.",
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro desconhecido";
      pushLog("error", `Falha: ${msg}`);
      toast({
        title: "Falha ao sincronizar planos",
        description: msg,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button onClick={handleClick} disabled={loading} size={size} variant={variant}>
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
        Sincronizar planos no Stripe
      </Button>
      <Dialog
        open={open}
        onOpenChange={(o) => {
          if (loading) return; // não fechar enquanto roda
          setOpen(o);
          if (!o) setSummary(null);
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {loading ? "Sincronizando planos no Stripe..." : "Resumo da sincronização"}
            </DialogTitle>
            <DialogDescription>
              Teste + Produção (live){module ? ` · módulo ${module}` : " · todos os módulos"}
              {loading && (
                <span className="ml-2 tabular-nums">· {fmtElapsed(elapsed)}</span>
              )}
            </DialogDescription>
          </DialogHeader>

          {/* Log em tempo real */}
          {logs.length > 0 && (
            <div className="rounded-md border border-border bg-muted/30">
              <div className="flex items-center justify-between border-b border-border px-3 py-1.5">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Log de execução
                </span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {logs.length} evento(s){loading ? ` · ${fmtElapsed(elapsed)}` : ""}
                </span>
              </div>
              <ScrollArea className="max-h-56">
                <ul className="px-3 py-2 font-mono text-[11px] leading-relaxed">
                  {logs.map((l, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="shrink-0 tabular-nums text-muted-foreground">
                        {fmtElapsed(l.ts).padStart(6, " ")}
                      </span>
                      <span className={LEVEL_COLOR[l.level]}>{l.text}</span>
                    </li>
                  ))}
                  <div ref={logBottomRef} />
                </ul>
              </ScrollArea>
            </div>
          )}

          {summary && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                {(["created", "updated", "skipped", "failed", "synced"] as SyncStatus[]).map((k) => (
                  <div
                    key={k}
                    className="rounded-md border border-border bg-muted/30 px-3 py-2 text-center"
                  >
                    <div className="text-2xl font-semibold tabular-nums">
                      {summary.totals[k]}
                    </div>
                    <div className="text-xs text-muted-foreground">{STATUS_LABEL[k]}</div>
                  </div>
                ))}
              </div>

              {summary.items.length > 0 ? (
                <ScrollArea className="max-h-72 rounded-md border border-border">
                  <ul className="divide-y divide-border">
                    {summary.items.map((it, i) => (
                      <li
                        key={`${it.slug ?? it.name}-${i}`}
                        className="flex items-center justify-between gap-3 px-3 py-2"
                      >
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium">{it.name}</div>
                          <div className="truncate text-xs text-muted-foreground">
                            {[it.tier, it.slug].filter(Boolean).join(" · ") || "—"}
                            {it.message ? ` — ${it.message}` : ""}
                          </div>
                        </div>
                        <StatusBadge status={it.status} />
                      </li>
                    ))}
                  </ul>
                </ScrollArea>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {summary.rawMessage ?? "Nenhum detalhe por plano retornado pela API."}
                </p>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="secondary"
              onClick={() => window.open("https://dashboard.stripe.com/test/products", "_blank", "noopener,noreferrer")}
              disabled={loading}
            >
              <ExternalLink className="h-4 w-4" />
              Abrir Teste
            </Button>
            <Button
              variant="secondary"
              onClick={() => window.open("https://dashboard.stripe.com/products", "_blank", "noopener,noreferrer")}
              disabled={loading}
            >
              <ExternalLink className="h-4 w-4" />
              Abrir Produção
            </Button>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              {loading ? "Aguarde..." : "Fechar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}