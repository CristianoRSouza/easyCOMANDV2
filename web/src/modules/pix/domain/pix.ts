/** Tipos e constantes do PIXnoPDV — `easyCONTROL/src/lib/pix-webhooks/*`, sem nada de rede. */

export type PixEnvironment = "homologacao" | "producao";
export type PixType = "recebimento" | "cobranca" | "deposito" | "devolucao" | "retirada";

export interface PixEndpoint {
  id: string;
  company_id: string;
  store_id: string;
  environment: PixEnvironment;
  pix_type: PixType;
  active: boolean;
  callback_url_prefix: string;
  registered_at: string | null;
  rotated_at: string | null;
  last_event_at: string | null;
  created_at: string;
}

/** Erro da EasyERP-API como as telas o leem: `code` (credentials_ambiguous…) e `details`. */
export interface PixApiError extends Error {
  code?: string;
  statusCode?: number;
  details?: { company_ids?: string[] } & Record<string, unknown>;
}

export const PIX_TYPES: { value: PixType; label: string }[] = [
  { value: "recebimento", label: "Recebimento" },
  { value: "cobranca", label: "Cobrança" },
  { value: "deposito", label: "Depósito" },
  { value: "devolucao", label: "Devolução" },
  { value: "retirada", label: "Retirada" },
];

export const PIX_ENVIRONMENTS: { value: PixEnvironment; label: string }[] = [
  { value: "producao", label: "Produção" },
  { value: "homologacao", label: "Homologação" },
];

export const PIX_DEFAULT_API_BASE_URL: Record<PixEnvironment, string> = {
  producao: "https://pixnopdv.com.br/api/v1",
  homologacao: "https://pixnopdv.com.br/api-h/v1",
};

export interface PixCredentialStatus {
  id: string | null;
  company_id: string;
  store_id: string;
  environment: PixEnvironment;
  api_base_url: string | null;
  basic_user: string | null;
  has_basic_token: boolean;
  has_secret_key: boolean;
  basic_token_masked: string | null;
  secret_key_masked: string | null;
  insecure_tls: boolean;
  enabled: boolean;
  updated_at: string | null;
}

export interface PixEventSummary {
  endpoint_id: string;
  total: number;
  last_received_at: string | null;
  last_status: string | null;
  last_outcome: string | null;
}

export interface PixStoreEventSummary {
  store_id: string;
  environment: string;
  total: number;
  last_received_at: string | null;
}

export interface PixEventRow {
  id: string;
  endpoint_id: string | null;
  store_id: string | null;
  pix_type: string;
  environment: string;
  status: string | null;
  outcome: string | null;
  tx_id: string | null;
  e2e_id: string | null;
  valor: number | null;
  received_at: string;
  processed_at: string | null;
  last_error: string | null;
}

export interface PixFeedEvent extends PixEventRow {
  company_id: string | null;
  qrcode_id: string | null;
  pix_status: string | null;
  emissao: string | null;
  attempts: number | null;
  body_bytes: number | null;
  payload: string | null;
}

export interface StoreLite {
  id: string;
  name: string;
  legal_name: string | null;
  cnpj: string | null;
  company_id: string;
  company_name: string | null;
}
