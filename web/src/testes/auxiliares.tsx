/* eslint-disable react/only-export-components -- arquivo usado só nos testes, sem fast refresh */
import type { ReactElement } from "react";
import { render } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { vi } from "vitest";
import type { Categoria, MaterialDetalhe, MaterialResumo, PontoProximo } from "../api";

/** Mostra a URL atual na tela, para os testes verificarem filtros gravados na URL. */
function UrlAtual() {
  const { pathname, search } = useLocation();
  return <output data-testid="url">{pathname + search}</output>;
}

export function renderizarNaRota(pagina: ReactElement, url: string, caminho = url.split("?")[0]) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path={caminho} element={<>{pagina}<UrlAtual /></>} />
        <Route path="*" element={<UrlAtual />} />
      </Routes>
    </MemoryRouter>);
}

type Resposta = unknown | ((url: URL) => unknown);

/**
 * Substitui o fetch: cada chave é um caminho da API (ex.: "/materiais"), e o valor é o JSON
 * devolvido. Use `falha(status)` para simular erro. Retorna o mock para inspecionar chamadas.
 */
export function simularApi(rotas: Record<string, Resposta>) {
  const fetchFalso = vi.fn(async (entrada: string | URL | Request, _init?: RequestInit) => {
    const url = new URL(String(entrada));
    const caminho = url.pathname.replace(/^\/v1/, "");
    const chave = Object.keys(rotas)
      .filter(r => caminho === r || caminho.startsWith(r + "/"))
      .sort((a, b) => b.length - a.length)[0];
    if (chave === undefined) return new Response(null, { status: 404 });

    const definicao = rotas[chave];
    const corpo = typeof definicao === "function" ? await definicao(url) : definicao;
    if (corpo instanceof Response) return corpo;
    return new Response(JSON.stringify(corpo), { status: 200, headers: { "Content-Type": "application/json" } });
  });
  vi.stubGlobal("fetch", fetchFalso);
  return fetchFalso;
}

export const falha = (status = 500) => new Response(null, { status });

/** Lista de URLs consultadas na API, sem o domínio. */
export const chamadas = (mock: ReturnType<typeof simularApi>) =>
  mock.mock.calls.map(([u]) => { const url = new URL(String(u)); return url.pathname + url.search; });

// ---------- Dados de exemplo ----------

export const categorias: Categoria[] = [
  { id: 1, nome: "Lâmpadas", icone: "lightbulb" },
  { id: 2, nome: "Pilhas e baterias", icone: "battery" },
];

export const materiais: MaterialResumo[] = [
  { id: 10, categoriaId: 1, categoria: "Lâmpadas", nome: "Lâmpada fluorescente", perigoso: true },
  { id: 11, categoriaId: 1, categoria: "Lâmpadas", nome: "Lâmpada de LED", perigoso: false },
  { id: 20, categoriaId: 2, categoria: "Pilhas e baterias", nome: "Pilha comum e alcalina", perigoso: true },
];

export const detalhePilha: MaterialDetalhe = {
  ...materiais[2], instrucoes: "Leve a um ponto de coleta de pilhas.", cuidados: "Não perfure nem queime.",
};

export const pontos: PontoProximo[] = [
  { id: "a", nome: "Coletor de pilhas", endereco: "Av. Brasil", distanciaMetros: 850, lat: -21.2, lng: -50.44, materiais: ["Pilha comum e alcalina"] },
  { id: "b", nome: "Ecoponto Norte", endereco: "Rua das Flores", distanciaMetros: 3284, lat: -21.18, lng: -50.44, materiais: ["Lâmpada fluorescente", "Pilha comum e alcalina"] },
];
