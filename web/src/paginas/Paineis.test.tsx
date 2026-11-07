import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { SessaoProvider, type Sessao } from "../sessao";
import { CadastroParceiroPagina, Entrar } from "./Contas";
import PainelParceiro, { Protegida } from "./Parceiro";
import PainelAdmin from "./Admin";
import { falha, materiais, simularApi } from "../testes/auxiliares";
import type { MeuPonto, PontoAdmin } from "../api";

vi.mock("react-leaflet", () => ({
  MapContainer: ({ children }: { children: ReactNode }) => <div data-testid="mapa">{children}</div>,
  TileLayer: () => null,
  Marker: () => <div data-testid="pino" />,
  useMap: () => ({ setView: vi.fn() }),
}));

const amanha = () => new Date(Date.now() + 86_400_000).toISOString();
const sessaoParceiro: Sessao = { token: "tok-parceiro", expiraEm: amanha(), nome: "Fulana", papel: "Parceiro" };
const sessaoAdmin: Sessao = { token: "tok-admin", expiraEm: amanha(), nome: "Admin", papel: "Admin" };

function Url() {
  const { pathname } = useLocation();
  return <output data-testid="url">{pathname}</output>;
}

function renderizar(url: string, sessao?: Sessao) {
  if (sessao) sessionStorage.setItem("descartaai.sessao", JSON.stringify(sessao));
  return render(
    <MemoryRouter initialEntries={[url]}>
      <SessaoProvider>
        <Routes>
          <Route path="/entrar" element={<Entrar />} />
          <Route path="/parceiro/cadastro" element={<CadastroParceiroPagina />} />
          <Route path="/parceiro" element={<Protegida papel="Parceiro"><PainelParceiro /></Protegida>} />
          <Route path="/admin" element={<Protegida papel="Admin"><PainelAdmin /></Protegida>} />
        </Routes>
        <Url />
      </SessaoProvider>
    </MemoryRouter>);
}

const json = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { "Content-Type": "application/json" } });

beforeEach(() => sessionStorage.clear());
afterEach(() => vi.unstubAllGlobals());

describe("Entrar", () => {
  it("entra como parceiro, guarda a sessão na aba e vai para o painel", async () => {
    const fetch = simularApi({ "/auth/login": json({ ...sessaoParceiro }), "/parceiro/pontos": [], "/materiais": materiais });
    renderizar("/entrar");

    await userEvent.type(screen.getByLabelText(/E-mail/), "fulana@mercado.com.br");
    await userEvent.type(screen.getByLabelText(/Senha/), "senha-segura-1");
    await userEvent.click(screen.getByRole("button", { name: "Entrar" }));

    await waitFor(() => expect(screen.getByTestId("url")).toHaveTextContent("/parceiro"));
    expect(JSON.parse(sessionStorage.getItem("descartaai.sessao")!).token).toBe("tok-parceiro");
    const login = fetch.mock.calls.find(([u]) => String(u).endsWith("/auth/login"))!;
    expect(login[1]).toMatchObject({ method: "POST", body: JSON.stringify({ email: "fulana@mercado.com.br", senha: "senha-segura-1" }) });
  });

  it("mostra mensagem clara para e-mail ou senha errados", async () => {
    simularApi({ "/auth/login": falha(401) });
    renderizar("/entrar");

    await userEvent.type(screen.getByLabelText(/E-mail/), "x@y.com");
    await userEvent.type(screen.getByLabelText(/Senha/), "errada123");
    await userEvent.click(screen.getByRole("button", { name: "Entrar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("E-mail ou senha incorretos.");
  });
});

describe("Cadastro de parceiro", () => {
  it("exige o aceite dos termos e mostra os erros de cada campo vindos da API", async () => {
    simularApi({ "/auth/cadastro": json({ errors: { email: ["Já existe uma conta com este e-mail."] } }, 400) });
    renderizar("/parceiro/cadastro");

    await userEvent.click(screen.getByRole("button", { name: "Criar conta" }));
    expect(screen.getByText(/aceite os termos/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("checkbox"));
    await userEvent.click(screen.getByRole("button", { name: "Criar conta" }));

    expect(await screen.findByText("Já existe uma conta com este e-mail.")).toBeInTheDocument();
    expect(screen.getByLabelText(/E-mail/)).toHaveAttribute("aria-invalid", "true");
  });
});

describe("Áreas restritas", () => {
  it("sem login, manda para a página de entrar", () => {
    renderizar("/admin");
    expect(screen.getByTestId("url")).toHaveTextContent("/entrar");
  });

  it("parceiro não acessa a administração", () => {
    simularApi({});
    renderizar("/admin", sessaoParceiro);
    expect(screen.getByRole("heading", { name: "Acesso restrito" })).toBeInTheDocument();
  });

  it("sessão recusada pelo servidor (401) desconecta o usuário", async () => {
    simularApi({ "/parceiro/pontos": falha(401) });
    renderizar("/parceiro", sessaoParceiro);
    await waitFor(() => expect(screen.getByTestId("url")).toHaveTextContent("/entrar"));
    expect(sessionStorage.getItem("descartaai.sessao")).toBeNull();
  });
});

const meuPonto: MeuPonto = {
  id: "p1", nome: "Coletor do Mercado", endereco: "Rua A, 10", cidade: "Araçatuba", uf: "SP",
  lat: -21.2, lng: -50.4, materiaisIds: [20], status: "Pendente", atualizadoEm: "2026-11-07T10:00:00Z",
};

describe("Painel do parceiro", () => {
  it("lista os pontos com a situação de cada um", async () => {
    simularApi({ "/parceiro/pontos": [meuPonto, { ...meuPonto, id: "p2", nome: "Outro", status: "Aprovado" }] });
    renderizar("/parceiro", sessaoParceiro);

    expect(await screen.findByText("Coletor do Mercado")).toBeInTheDocument();
    expect(screen.getByText("Em análise")).toBeInTheDocument();
    expect(screen.getByText("Publicado no mapa")).toBeInTheDocument();
  });

  it("cadastra ponto: localiza o endereço, escolhe materiais e envia com o token", async () => {
    let enviado: RequestInit | undefined;
    const fetch = simularApi({
      "/parceiro/pontos": [],
      "/materiais": materiais,
      "/localizacao": [{ descricao: "Rua B, Araçatuba", lat: -21.21, lng: -50.43 }],
    });
    renderizar("/parceiro", sessaoParceiro);

    await userEvent.click(await screen.findByRole("button", { name: /Cadastrar ponto/ }));
    await userEvent.type(screen.getByLabelText(/Nome do ponto/), "Ponto novo");
    await userEvent.type(screen.getByLabelText(/Rua e número/), "Rua B, 20");
    await userEvent.click(screen.getByRole("button", { name: /Localizar no mapa/ }));
    expect(await screen.findByTestId("pino")).toBeInTheDocument();
    await userEvent.click(await screen.findByLabelText("Pilha comum e alcalina"));

    fetch.mockImplementation(async (u: string | URL | Request, init?: RequestInit) => {
      if (String(u).endsWith("/parceiro/pontos") && init?.method === "POST") { enviado = init; return json({ id: "novo" }, 201); }
      return json([]);
    });
    await userEvent.click(screen.getByRole("button", { name: /Enviar para aprovação/ }));

    expect(await screen.findByText(/aparece no mapa assim que a equipe aprovar/)).toBeInTheDocument();
    expect((enviado!.headers as Record<string, string>).Authorization).toBe("Bearer tok-parceiro");
    expect(JSON.parse(String(enviado!.body))).toMatchObject({
      nome: "Ponto novo", endereco: "Rua B, 20", cidade: "Araçatuba", uf: "SP", lat: -21.21, lng: -50.43, materiaisIds: [20],
    });
  });
});

const pontoAdmin: PontoAdmin = {
  id: "x1", nome: "Ponto do parceiro", endereco: "Rua C", cidade: "Araçatuba", uf: "SP", lat: -21.2, lng: -50.4,
  materiais: ["Pilha comum e alcalina"], status: "Pendente", parceiro: "Mercado Teste", atualizadoEm: "2026-11-07T10:00:00Z",
  reportesPendentes: 0,
};

describe("Painel do admin", () => {
  it("aprova um ponto pendente", async () => {
    const fetch = simularApi({ "/admin/pontos": [pontoAdmin] });
    renderizar("/admin", sessaoAdmin);

    const item = (await screen.findByText("Ponto do parceiro")).closest("li")!;
    expect(within(item).getByText(/Parceiro: Mercado Teste/)).toBeInTheDocument();

    fetch.mockImplementation(async (_u: string | URL | Request, init?: RequestInit) =>
      init?.method === "PATCH" ? new Response(null, { status: 204 }) : json([]));
    await userEvent.click(within(item).getByRole("button", { name: "Aprovar Ponto do parceiro" }));

    await waitFor(() => expect(fetch.mock.calls.some(([u, i]) =>
      String(u).endsWith("/admin/pontos/x1/status") && i?.method === "PATCH" && i.body === JSON.stringify({ status: "Aprovado" }))).toBe(true));
    expect(await screen.findByText("Nenhum ponto nesta situação.")).toBeInTheDocument();
  });

  it("mostra as estatísticas de uso", async () => {
    simularApi({
      "/admin/pontos": [],
      "/admin/estatisticas": {
        identificacoes: 10, identificacoesConfirmadas: 8, identificacoesCorrigidas: 2, taxaDeAcerto: 0.75, buscas: 42,
        pontosPorStatus: { Pendente: 1, Aprovado: 5, Rejeitado: 0, Inativo: 0 }, parceiros: 3, reportesPendentes: 1,
        materiaisMaisIdentificados: [{ material: "Pilha comum e alcalina", quantidade: 6 }],
      },
    });
    renderizar("/admin", sessaoAdmin);

    await userEvent.click(screen.getByRole("tab", { name: "Estatísticas" }));

    expect(await screen.findByText("42")).toBeInTheDocument();
    expect(screen.getByText("75%")).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "Pilha comum e alcalina" })).toBeInTheDocument();
  });
});
