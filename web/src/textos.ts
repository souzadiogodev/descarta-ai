import type { StatusPonto } from "./api";

export const TEXTO_STATUS: Record<StatusPonto, string> = {
  Pendente: "Em análise",
  Aprovado: "Publicado no mapa",
  Rejeitado: "Não aprovado",
  Inativo: "Desativado",
};
