import { apiRequest, withQuery } from "@/shared/http/api-client";
import type { ChamadaComData } from "@/shared/http/server-fn";
import type { PixEventRow, PixEventSummary, PixFeedEvent, PixStoreEventSummary } from "../domain/pix";

export type { PixEventRow, PixEventSummary, PixFeedEvent, PixStoreEventSummary } from "../domain/pix";

type FiltroDoResumo = { endpoint_id?: string; store_id?: string; environment?: string };
type FiltroDoFeed = FiltroDoResumo & {
  pix_type?: string;
  outcome?: string;
  search?: string;
  cursor?: string;
  limit?: number;
};

/** `listPixWebhookEvents` de hoje: eventos + resumo por endpoint e por loja. */
export const listPixWebhookEvents = ({ data }: ChamadaComData<FiltroDoResumo | undefined>) =>
  apiRequest<{ events: PixEventRow[]; summary: PixEventSummary[]; storeSummary: PixStoreEventSummary[] }>(
    withQuery("/pix/events", { ...(data ?? {}) }),
  );

/** `listPixWebhookFeed` de hoje: linha do tempo paginada por cursor. */
export const listPixWebhookFeed = ({ data }: ChamadaComData<FiltroDoFeed | undefined>) =>
  apiRequest<{ items: PixFeedEvent[]; nextCursor: string | null }>(withQuery("/pix/events/feed", { ...(data ?? {}) }));
