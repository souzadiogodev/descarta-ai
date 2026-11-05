import type { NavigatorScreenParams } from "@react-navigation/native";
import type { PontoProximo } from "./api";

export type Abas = {
  Inicio: undefined;
  Guia: { busca?: string } | undefined;
  Mapa: { materialId?: number; materialNome?: string } | undefined;
};
export type Rotas = {
  Abas: NavigatorScreenParams<Abas> | undefined;
  Material: { id: number; nome: string };
  Ponto: { ponto: PontoProximo };
  Foto: undefined;
};
