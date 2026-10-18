import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./fonts.css";
import "../styles.css";
import { Providers } from "./providers";

// CSP com nonce (src/proxy.ts): o nonce muda a cada requisição, então as páginas não podem ser
// pré-renderizadas — o Next aplica o nonce do cabeçalho nos scripts que injeta.
export const dynamic = "force-dynamic";

const TITLE = "EasySoft Control Center";
const DESCRIPTION =
  "Painel administrativo central do ecossistema EasySoft — uso interno restrito à equipe técnica.";
const SHARE_DESCRIPTION =
  "Descrição curta (até 160 caracteres): Painel administrativo unificado da EasySoft para gestão de planos, faturamento, módulos (EasyFoodPay, EasyML, EasyChat)";
const OG_IMAGE =
  "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/e4a87a9e-7469-4514-a20e-d0eab58828e5/id-preview-b2486f39--1f23d3fd-5ae6-4331-8ea9-96edf7bb5eac.lovable.app-1778791412607.png";

/** Mesmos `<title>` e metas do `head()` de `easyCONTROL/src/routes/__root.tsx`. */
export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  authors: [{ name: "EasySoft" }],
  icons: { icon: "/favicon.ico" },
  openGraph: { title: TITLE, description: SHARE_DESCRIPTION, type: "website", images: [OG_IMAGE] },
  twitter: { card: "summary", title: TITLE, description: SHARE_DESCRIPTION, images: [OG_IMAGE] },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // `lang="en"` como hoje (`RootShell` do `__root.tsx`).
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
