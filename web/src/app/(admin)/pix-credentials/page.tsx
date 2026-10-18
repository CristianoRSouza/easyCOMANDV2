import type { Metadata } from "next";

/** Mesmo `head()` da rota de hoje (`_admin.pix-credentials.tsx`). */
export const metadata: Metadata = {
  title: "Credenciais PIXnoPDV | EasySoft Control Center",
  description: "Cadastro das credenciais PIXnoPDV de cada loja por ambiente.",
  openGraph: {
    title: "Credenciais PIXnoPDV",
    description: "Cadastro das credenciais PIXnoPDV de cada loja por ambiente.",
    type: "website",
  },
  twitter: { card: "summary" },
};

import { PixCredentialsPage } from "@/modules/pix/ui/PixCredentialsPage";

export default function Page() {
  return <PixCredentialsPage />;
}
