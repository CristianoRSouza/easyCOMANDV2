"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { onSessionExpired } from "@/shared/http/session-events";
import { entrar, revalidar, sair, type AdminUser } from "./session-client";

export type { AdminRole, AdminUser } from "./session-client";

interface AuthContextValue {
  user: AdminUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/** Texto de hoje para quem não é da equipe técnica. */
export const ACCESS_DENIED_MESSAGE = "Acesso restrito à equipe técnica EasySoft.";

/**
 * Cache do administrador no localStorage — a MESMA chave de hoje. Só nome/e-mail/papel (nenhum
 * token): serve para a tela aparecer na hora em vez de piscar o "Verificando credenciais…" a cada
 * carga, enquanto a sessão é revalidada em segundo plano.
 */
const ADMIN_CACHE_KEY = "easysoft.admin_user";

function readCachedAdmin(): AdminUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(ADMIN_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AdminUser;
    if (parsed && parsed.id && (parsed.role === "system_admin" || parsed.role === "tech_admin")) return parsed;
    return null;
  } catch {
    return null;
  }
}

function writeCachedAdmin(u: AdminUser | null) {
  if (typeof window === "undefined") return;
  try {
    if (u) localStorage.setItem(ADMIN_CACHE_KEY, JSON.stringify(u));
    else localStorage.removeItem(ADMIN_CACHE_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * O `AuthProvider` de hoje, com a sessão no BFF em vez do localStorage:
 *   • com cache → mostra a tela na hora e revalida em segundo plano;
 *   • sem cache → bloqueia (splash) até a revalidação responder;
 *   • revalidação "fora" → limpa e a guarda manda ao login; "incerto" → mantém o que tinha.
 * Qualquer 401 de uma chamada da tela (sessão caiu) também desloga.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let montado = true;
    const cached = readCachedAdmin();
    if (cached) {
      // O cache mora no localStorage, que só existe no navegador: ler na renderização faria o HTML
      // do servidor (sem usuário) divergir do cliente. Por isso a leitura é no efeito, de propósito.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setUser(cached);
      setLoading(false);
    }
    void revalidar().then((r) => {
      if (!montado) return;
      if (r.estado === "admin") {
        writeCachedAdmin(r.user);
        setUser(r.user);
      } else if (r.estado === "fora") {
        writeCachedAdmin(null);
        setUser(null);
      }
      setLoading(false);
    });
    const desligar = onSessionExpired(() => {
      writeCachedAdmin(null);
      setUser(null);
    });
    return () => {
      montado = false;
      desligar();
    };
  }, []);

  const login = async (email: string, password: string) => {
    const admin = await entrar(email, password);
    writeCachedAdmin(admin);
    setUser(admin);
  };

  const logout = async () => {
    await sair();
    writeCachedAdmin(null);
    setUser(null);
  };

  return <AuthContext.Provider value={{ user, loading, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
