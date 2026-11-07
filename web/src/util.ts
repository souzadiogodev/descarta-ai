import { useEffect, useState } from "react";
import { foiCancelada } from "./api";

/** 850 → "850 m"; 1534 → "1,5 km". */
export const formatarDistancia = (metros: number) =>
  metros < 1000 ? `${Math.round(metros)} m` : `${(metros / 1000).toFixed(1).replace(".", ",")} km`;

export const plural = (n: number, singular: string, pluralTexto: string) => `${n} ${n === 1 ? singular : pluralTexto}`;

export const urlRota = (lat: number, lng: number) =>
  `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;

export const urlWaze = (lat: number, lng: number) =>
  `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`;

/**
 * Fundo do mapa. Com chave do MapTiler (plano grátis), usa os tiles dele; sem chave, os do
 * OpenStreetMap, que servem para desenvolvimento mas não para tráfego de produção.
 */
const CHAVE_MAPA = import.meta.env.VITE_MAPTILER_CHAVE;
export const TILES = CHAVE_MAPA
  ? { url: `https://api.maptiler.com/maps/streets-v2/256/{z}/{x}/{y}.png?key=${CHAVE_MAPA}`,
      atribuicao: '&copy; <a href="https://www.maptiler.com/copyright/">MapTiler</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' }
  : { url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
      atribuicao: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' };

/** Lê um parâmetro numérico positivo da URL; ignora valores inválidos. */
export const numeroDaUrl = (params: URLSearchParams, chave: string) => {
  const n = Number(params.get(chave));
  return Number.isFinite(n) && n > 0 ? n : undefined;
};

type Estado<T> = { dados?: T; erro: boolean; carregando: boolean };

/**
 * Executa uma consulta e refaz quando as dependências mudam, cancelando a anterior.
 * Evita que uma resposta antiga (lenta) sobrescreva a mais recente.
 */
export function useConsulta<T>(buscar: (sinal: AbortSignal) => Promise<T>, deps: unknown[]) {
  const [estado, setEstado] = useState<Estado<T>>({ erro: false, carregando: true });
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    const controle = new AbortController();
    setEstado(e => ({ ...e, erro: false, carregando: true }));
    buscar(controle.signal)
      .then(dados => setEstado({ dados, erro: false, carregando: false }))
      .catch(e => { if (!foiCancelada(e)) setEstado({ erro: true, carregando: false }); });
    return () => controle.abort();
    // buscar é recriado a cada render; as dependências reais vêm de quem chama.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tentativa]);

  return { ...estado, tentarDeNovo: () => setTentativa(t => t + 1) };
}
