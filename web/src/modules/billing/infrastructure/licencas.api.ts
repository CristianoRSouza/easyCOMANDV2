import { apiRequest } from "@/shared/http/api-client";

/**
 * Licenças (tela "Licenças & Assinaturas") — hoje 2 e 3 consultas do navegador; agora a API faz as
 * mesmas e devolve as linhas já com o nome da empresa (e, nos planos, o uso de 30 dias).
 */
export const listarLicencasDeTotem = <T>() => apiRequest<T[]>("/billing/totem-licenses");
export const listarPlanosDasEmpresas = <T>() => apiRequest<T[]>("/billing/company-plans");
