"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useServerFn } from "@/shared/http/server-fn";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AlertTriangle, ChevronDown, Loader2, RefreshCw, Search } from "lucide-react";
import { listPixWebhookFeed, type PixFeedEvent } from "@/modules/pix/infrastructure/events.functions";
import { PIX_ENVIRONMENTS, PIX_TYPES } from "@/modules/pix/infrastructure/client";
import type { StoreLite } from "@/modules/pix/infrastructure/use-stores";
import { Button } from "@/shared/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { cn } from "@/shared/lib/utils";

const envLabel = (e: string) => PIX_ENVIRONMENTS.find((p) => p.value === e)?.label ?? e;
const typeLabel = (t: string) => PIX_TYPES.find((p) => p.value === t)?.label ?? t;

const brl = (v: number | null) =>
  v == null ? "—" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function OutcomeBadge({ event }: { event: PixFeedEvent }) {
  const value = event.outcome ?? event.status ?? "—";
  const ok = /ok|success|sucesso|delivered|processed/i.test(value);
  const fail = /error|fail|erro|dead/i.test(value) || !!event.last_error;
  return (
    <span
      className={cn(
        "rounded-md px-2 py-0.5 text-[11px] font-medium",
        ok && "bg-emerald-500/10 text-emerald-400",
        fail && "bg-destructive/10 text-destructive",
        !ok && !fail && "bg-muted text-muted-foreground",
      )}
    >
      {value}
    </span>
  );
}

function EventCard({ event, store }: { event: PixFeedEvent; store?: StoreLite }) {
  const [open, setOpen] = useState(false);
  const received = new Date(event.received_at);
  return (
    <div className="relative pl-6">
      <span className="absolute left-0 top-3 h-2.5 w-2.5 rounded-full bg-primary ring-4 ring-primary/15" />
      <div className="rounded-xl border border-border bg-card/40 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs text-muted-foreground">
            {format(received, "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
          </span>
          <span className="rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
            {typeLabel(event.pix_type)}
          </span>
          <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
            {envLabel(event.environment)}
          </span>
          <OutcomeBadge event={event} />
          <span className="ml-auto text-sm font-semibold">{brl(event.valor)}</span>
        </div>

        <div className="mt-2 grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
          <span className="truncate">
            Loja: <span className="text-foreground">{store?.name ?? event.store_id ?? "—"}</span>
          </span>
          <span className="truncate">
            TxID: <span className="font-mono text-foreground">{event.tx_id ?? "—"}</span>
          </span>
          <span className="truncate">
            E2E: <span className="font-mono text-foreground">{event.e2e_id ?? "—"}</span>
          </span>
          <span className="truncate">
            Status PIX: <span className="text-foreground">{event.pix_status ?? "—"}</span>
          </span>
        </div>

        {event.last_error ? (
          <p className="mt-2 flex items-start gap-1.5 rounded-md bg-destructive/5 p-2 text-xs text-destructive">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {event.last_error}
          </p>
        ) : null}

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="mt-3 flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
          {open ? "Ocultar detalhes" : "Ver payload completo"}
        </button>

        {open ? (
          <pre className="mt-2 max-h-80 overflow-auto rounded-lg border border-border bg-background/60 p-3 text-[11px] leading-relaxed">
            {event.payload ?? "{}"}
          </pre>
        ) : null}
      </div>
    </div>
  );
}

export function PixEventsTimeline({ stores }: { stores?: Map<string, StoreLite> }) {
  const feed = useServerFn(listPixWebhookFeed);
  const [envFilter, setEnvFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const query = useInfiniteQuery({
    queryKey: ["pix-webhooks", "feed", envFilter, typeFilter, search],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      feed({
        data: {
          cursor: pageParam,
          limit: 25,
          environment: envFilter === "all" ? undefined : envFilter,
          pix_type: typeFilter === "all" ? undefined : typeFilter,
          search: search || undefined,
        },
      }),
    getNextPageParam: (last: { nextCursor: string | null }) => last.nextCursor ?? undefined,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  const items = useMemo(
    () => (query.data?.pages ?? []).flatMap((p: { items: PixFeedEvent[] }) => p.items),
    [query.data],
  );

  const sentinel = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && query.hasNextPage && !query.isFetchingNextPage) {
          void query.fetchNextPage();
        }
      },
      { rootMargin: "300px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [query]);

  return (
    <div className="space-y-4 rounded-2xl border border-border bg-card/40 p-5 shadow-[var(--shadow-elegant)] sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-base font-semibold tracking-tight">
            Eventos recebidos
          </h2>
          <p className="text-xs text-muted-foreground">
            {items.length} evento(s) carregado(s){query.hasNextPage ? " · role para carregar mais" : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Buscar TxID, E2E ou QRCode"
              className="w-full rounded-md border border-input bg-input py-1.5 pl-8 pr-3 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
            />
          </div>
          <Select value={envFilter} onValueChange={setEnvFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Ambiente" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os ambientes</SelectItem>
              {PIX_ENVIRONMENTS.map((e) => (
                <SelectItem key={e.value} value={e.value}>
                  {e.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              {PIX_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            disabled={query.isFetching}
            onClick={() => void query.refetch()}
          >
            <RefreshCw className={cn("mr-1.5 h-4 w-4", query.isFetching && "animate-spin")} />
            Atualizar
          </Button>
        </div>
      </div>

      {query.error ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-10 text-center">
          <AlertTriangle className="h-5 w-5 text-destructive" />
          <p className="text-sm text-destructive">{(query.error as Error).message}</p>
          <Button variant="outline" size="sm" onClick={() => void query.refetch()}>
            Tentar novamente
          </Button>
        </div>
      ) : query.isLoading ? (
        <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando eventos…
        </div>
      ) : items.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          Nenhum evento recebido com os filtros atuais.
        </p>
      ) : (
        <div className="relative space-y-3 before:absolute before:left-[4px] before:top-2 before:h-full before:w-px before:bg-border">
          {items.map((e) => (
            <EventCard key={e.id} event={e} store={e.store_id ? stores?.get(e.store_id) : undefined} />
          ))}
        </div>
      )}

      <div ref={sentinel} />
      {query.isFetchingNextPage ? (
        <div className="flex items-center justify-center gap-2 py-4 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Carregando mais…
        </div>
      ) : null}
    </div>
  );
}
