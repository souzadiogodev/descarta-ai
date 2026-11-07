/* eslint-disable react/only-export-components -- provedor e hook da sessão ficam juntos */
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

export type Papel = "Parceiro" | "Admin";
export type Sessao = { token: string; expiraEm: string; nome: string; papel: Papel };

const CHAVE = "descartaai.sessao";

/**
 * A sessão fica no sessionStorage: some ao fechar a aba, o que reduz o risco num computador
 * compartilhado (ex.: o caixa de um mercado parceiro).
 */
export function lerSessao(): Sessao | undefined {
  try {
    const s = JSON.parse(sessionStorage.getItem(CHAVE) ?? "null") as Sessao | null;
    return s && new Date(s.expiraEm) > new Date() ? s : undefined;
  } catch {
    return undefined;
  }
}

function gravar(s?: Sessao) {
  try {
    if (s) sessionStorage.setItem(CHAVE, JSON.stringify(s)); else sessionStorage.removeItem(CHAVE);
  } catch { /* armazenamento bloqueado: a sessão vale só enquanto a página estiver aberta */ }
}

/** Avisado pelo cliente da API quando o servidor recusa o token (expirado ou inválido). */
export const EVENTO_SAIU = "descartaai:sessao-expirada";

type Contexto = { sessao?: Sessao; entrar: (s: Sessao) => void; sair: () => void };
const SessaoContexto = createContext<Contexto>({ entrar: () => {}, sair: () => {} });

export function SessaoProvider({ children }: { children: ReactNode }) {
  const [sessao, setSessao] = useState(lerSessao);
  const entrar = useCallback((s: Sessao) => { gravar(s); setSessao(s); }, []);
  const sair = useCallback(() => { gravar(undefined); setSessao(undefined); }, []);

  useEffect(() => {
    window.addEventListener(EVENTO_SAIU, sair);
    return () => window.removeEventListener(EVENTO_SAIU, sair);
  }, [sair]);

  return <SessaoContexto.Provider value={{ sessao, entrar, sair }}>{children}</SessaoContexto.Provider>;
}

export const useSessao = () => useContext(SessaoContexto);
