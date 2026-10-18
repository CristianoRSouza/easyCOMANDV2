import { apiRequest } from "@/shared/http/api-client";

/**
 * Telas dos módulos EasyFoodPay e EasyML Connect — hoje consultas do navegador (views, schema
 * `connect`/`billing` e RPCs de KPI); agora pela API, com as mesmas colunas, ordem e limites.
 */
export const listarTotens = <T>() => apiRequest<T[]>("/modules/easycommandpay/totems");
export const listarAgentes = <T>() => apiRequest<T[]>("/modules/easycommandpay/agents");
export const kpisEasyCommandPay = <T>() => apiRequest<T>("/modules/easycommandpay/kpis");
export const kpisEasyMl = <T>() => apiRequest<T>("/modules/easyml/kpis");
export const listarConexoesMl = <T>() => apiRequest<T[]>("/modules/easyml/connections");
export const listarPedidosMl = <T>() => apiRequest<T[]>("/modules/easyml/orders");
export const listarUsoDeIa = <T>() => apiRequest<T[]>("/modules/easyml/ai-usage");
