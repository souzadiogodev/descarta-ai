import { EVENTO_SAIU, lerSessao, type Sessao } from "./sessao";

const BASE = import.meta.env.VITE_API_URL ?? "http://localhost:5158/v1";

export type Categoria = { id: number; nome: string; icone?: string; cor?: string };
export type MaterialResumo = { id: number; categoriaId: number; categoria: string; nome: string; perigoso: boolean };
export type MaterialDetalhe = MaterialResumo & { instrucoes: string; cuidados?: string; sinonimos?: string[] };
export type PontoProximo = {
  id: string; nome: string; endereco: string; distanciaMetros: number;
  lat: number; lng: number; materiais: string[];
};
export type PontoDetalhe = {
  id: string; nome: string; endereco: string; cidade: string; uf: string; cep?: string;
  telefone?: string; horario?: string; lat: number; lng: number; materiais: string[];
};
export type Local = { descricao: string; lat: number; lng: number };
export type MotivoReporte = "Fechado" | "EnderecoErrado" | "NaoAceitaMaterial" | "Outro";

export type StatusPonto = "Pendente" | "Aprovado" | "Rejeitado" | "Inativo";
export type PontoEntrada = {
  nome: string; endereco: string; cidade: string; uf: string; cep?: string;
  telefone?: string; horario?: string; lat?: number; lng?: number; materiaisIds: number[];
};
export type MeuPonto = PontoEntrada & { id: string; lat: number; lng: number; status: StatusPonto; atualizadoEm: string };
export type CadastroParceiro = {
  nome: string; email: string; senha: string; organizacao: string; tipo: string; documento?: string; telefone?: string;
};
export type PontoAdmin = {
  id: string; nome: string; endereco: string; cidade: string; uf: string; cep?: string; telefone?: string; horario?: string;
  lat: number; lng: number; materiais: string[]; status: StatusPonto; parceiro?: string; atualizadoEm: string; reportesPendentes: number;
};
export type ReporteAdmin = {
  id: string; pontoId: string; ponto: string; motivo: MotivoReporte; comentario?: string;
  status: "Pendente" | "Resolvido" | "Descartado"; criadoEm: string;
};
export type MaterialEntrada = {
  categoriaId: number; nome: string; instrucoes: string; cuidados?: string; sinonimos?: string[]; perigoso: boolean;
};
export type Estatisticas = {
  identificacoes: number; identificacoesConfirmadas: number; identificacoesCorrigidas: number; taxaDeAcerto?: number;
  buscas: number; pontosPorStatus: Record<StatusPonto, number>; parceiros: number; reportesPendentes: number;
  materiaisMaisIdentificados: { material: string; quantidade: number }[];
};

/** Erro da API com o código HTTP e, em erros de validação (400), a mensagem de cada campo. */
export class ErroApi extends Error {
  status: number;
  campos: Record<string, string[]>;
  constructor(status: number, campos: Record<string, string[]> = {}, titulo?: string) {
    super(titulo ?? `Erro ${status} ao consultar a API`);
    this.status = status;
    this.campos = campos;
  }
}

async function chamar<T>(metodo: string, caminho: string, corpo?: unknown, sinal?: AbortSignal): Promise<T> {
  const sessao = lerSessao();
  const headers: Record<string, string> = {};
  if (corpo !== undefined) headers["Content-Type"] = "application/json";
  if (sessao) headers.Authorization = `Bearer ${sessao.token}`;

  const resposta = await fetch(BASE + caminho, metodo === "GET" && !sessao
    ? { signal: sinal }
    : { method: metodo, headers, body: corpo === undefined ? undefined : JSON.stringify(corpo), signal: sinal });

  if (!resposta.ok) {
    if (resposta.status === 401 && sessao) window.dispatchEvent(new Event(EVENTO_SAIU));
    let problema: { title?: string; errors?: Record<string, string[]> } = {};
    try { problema = await resposta.json(); } catch { /* corpo vazio */ }
    throw new ErroApi(resposta.status, problema.errors, problema.errors ? undefined : problema.title);
  }
  return resposta.status === 204 || resposta.headers.get("Content-Length") === "0"
    ? (undefined as T)
    : resposta.json().catch(() => undefined as T);
}

const get = <T,>(caminho: string, sinal?: AbortSignal) => chamar<T>("GET", caminho, undefined, sinal);

/** Requisição cancelada porque o componente mudou de filtro ou saiu da tela: não é erro para o usuário. */
export const foiCancelada = (e: unknown) => e instanceof DOMException && e.name === "AbortError";

const consulta = (valores: Record<string, string | number | undefined>) => {
  const q = new URLSearchParams();
  for (const [chave, valor] of Object.entries(valores))
    if (valor !== undefined && valor !== "") q.set(chave, String(valor));
  const texto = q.toString();
  return texto ? `?${texto}` : "";
};

export const api = {
  categorias: (sinal?: AbortSignal) => get<Categoria[]>("/categorias", sinal),
  materiais: (filtro: { busca?: string; categoriaId?: number } = {}, sinal?: AbortSignal) =>
    get<MaterialResumo[]>(`/materiais${consulta(filtro)}`, sinal),
  material: (id: number, sinal?: AbortSignal) => get<MaterialDetalhe>(`/materiais/${id}`, sinal),
  proximos: (filtro: { lat: number; lng: number; raio: number; materialId?: number }, sinal?: AbortSignal) =>
    get<PontoProximo[]>(`/pontos/proximos${consulta(filtro)}`, sinal),
  ponto: (id: string, sinal?: AbortSignal) => get<PontoDetalhe>(`/pontos/${id}`, sinal),
  localizar: (endereco: string, sinal?: AbortSignal) => get<Local[]>(`/localizacao${consulta({ endereco })}`, sinal),
  reportar: (pontoId: string, motivo: MotivoReporte, comentario?: string) =>
    chamar<void>("POST", `/pontos/${pontoId}/reportes`, { motivo, comentario }),

  // Contas
  entrar: (email: string, senha: string) => chamar<Sessao>("POST", "/auth/login", { email, senha }),
  cadastrar: (dados: CadastroParceiro) => chamar<Sessao>("POST", "/auth/cadastro", dados),

  // Parceiro
  meusPontos: (sinal?: AbortSignal) => get<MeuPonto[]>("/parceiro/pontos", sinal),
  criarPonto: (p: PontoEntrada) => chamar<{ id: string }>("POST", "/parceiro/pontos", p),
  editarPonto: (id: string, p: PontoEntrada) => chamar<{ id: string }>("PUT", `/parceiro/pontos/${id}`, p),

  // Administração
  pontosAdmin: (status: StatusPonto | undefined, sinal?: AbortSignal) =>
    get<PontoAdmin[]>(`/admin/pontos${consulta({ status })}`, sinal),
  mudarStatusPonto: (id: string, status: Exclude<StatusPonto, "Pendente">) =>
    chamar<void>("PATCH", `/admin/pontos/${id}/status`, { status }),
  reportesAdmin: (status: ReporteAdmin["status"] | undefined, sinal?: AbortSignal) =>
    get<ReporteAdmin[]>(`/admin/reportes${consulta({ status })}`, sinal),
  mudarStatusReporte: (id: string, status: "Resolvido" | "Descartado") =>
    chamar<void>("PATCH", `/admin/reportes/${id}`, { status }),
  criarMaterial: (m: MaterialEntrada) => chamar<{ id: number }>("POST", "/admin/materiais", m),
  editarMaterial: (id: number, m: MaterialEntrada) => chamar<void>("PUT", `/admin/materiais/${id}`, m),
  excluirMaterial: (id: number) => chamar<void>("DELETE", `/admin/materiais/${id}`),
  criarCategoria: (nome: string) => chamar<{ id: number }>("POST", "/admin/categorias", { nome }),
  estatisticas: (sinal?: AbortSignal) => get<Estatisticas>("/admin/estatisticas", sinal),
};

/** Texto amigável para um erro da API, usado nos formulários. */
export function mensagemDeErro(e: unknown, padrao = "Não foi possível concluir. Tente de novo.") {
  if (e instanceof ErroApi) {
    if (e.status === 429) return "Muitas tentativas em pouco tempo. Aguarde um minuto e tente de novo.";
    if (e.status === 401) return "Sua sessão expirou. Entre de novo.";
    if (e.status === 403) return "Você não tem permissão para esta ação.";
    const primeira = Object.values(e.campos)[0]?.[0];
    if (primeira) return primeira;
    if (e.status < 500 && !e.message.startsWith("Erro ")) return e.message;
  }
  if (e instanceof TypeError) return "Sem conexão com o servidor. Verifique sua internet.";
  return padrao;
}
