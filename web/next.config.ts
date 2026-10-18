import type { NextConfig } from "next";

/**
 * Os cabeçalhos de segurança (CSP com nonce incluída) ficam em `src/proxy.ts`: o nonce muda a cada
 * requisição e não cabe numa lista estática de `headers()`.
 */
const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Servidor mínimo (server.js + só as dependências usadas) para a imagem Docker.
  output: "standalone",
};

export default nextConfig;
