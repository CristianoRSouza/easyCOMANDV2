"use client";

import { useState, type ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/shared/ui/sonner";
import { createQueryClient } from "@/shared/http/query-client";
import { AuthProvider } from "@/shared/session/auth-provider";

/**
 * Mesma árvore do `RootComponent` de `easyCONTROL/src/routes/__root.tsx`:
 * QueryClient → AuthProvider → conteúdo + `<Toaster />`.
 */
export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(createQueryClient);
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        {children}
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}
