// Mesmo contrato do site (web/src/api.ts). No celular, "localhost" é o próprio aparelho:
// defina EXPO_PUBLIC_API_URL com o IP do computador na rede (ex.: http://192.168.0.10:5158/v1).
const BASE = process.env.EXPO_PUBLIC_API_URL ?? "http://10.0.2.2:5158/v1";

export type Categoria = { id: number; nome: string; icone?: string };
export type MaterialResumo = { id: number; categoriaId: number; categoria: string; nome: string; perigoso: boolean };
export type MaterialDetalhe = MaterialResumo & { instrucoes: string; cuidados?: string; sinonimos?: string[] };
export type PontoProximo = {
  id: string; nome: string; endereco: string; distanciaMetros: number;
  lat: number; lng: number; materiais: string[];
};

async function get<T>(caminho: string, sinal?: AbortSignal): Promise<T> {
  const resposta = await fetch(BASE + caminho, { signal: sinal });
  if (!resposta.ok) throw new Error(`Erro ${resposta.status} ao consultar a API`);
  return resposta.json();
}

export const foiCancelada = (e: unknown) => e instanceof Error && e.name === "AbortError";

export const consulta = (valores: Record<string, string | number | undefined>) => {
  const partes = Object.entries(valores)
    .filter(([, v]) => v !== undefined && v !== "")
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  return partes.length ? `?${partes.join("&")}` : "";
};

export const api = {
  categorias: (sinal?: AbortSignal) => get<Categoria[]>("/categorias", sinal),
  materiais: (filtro: { busca?: string; categoriaId?: number } = {}, sinal?: AbortSignal) =>
    get<MaterialResumo[]>(`/materiais${consulta(filtro)}`, sinal),
  material: (id: number, sinal?: AbortSignal) => get<MaterialDetalhe>(`/materiais/${id}`, sinal),
  proximos: (filtro: { lat: number; lng: number; raio: number; materialId?: number }, sinal?: AbortSignal) =>
    get<PontoProximo[]>(`/pontos/proximos${consulta(filtro)}`, sinal),
};

export const formatarDistancia = (m: number) =>
  m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1).replace(".", ",")} km`;

/** Centro de Araçatuba, usado quando o usuário não libera a localização. */
export const CENTRO_PADRAO = { lat: -21.2089, lng: -50.4328 };
