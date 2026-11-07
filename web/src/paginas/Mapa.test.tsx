import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Mapa from "./Mapa";
import { chamadas, falha, materiais, pontos, renderizarNaRota, simularApi } from "../testes/auxiliares";

// O Leaflet desenha em canvas/tiles, que não existem no jsdom: trocamos o mapa por uma versão
// simples que só renderiza os marcadores, e registramos os movimentos de câmera.
const camera = vi.hoisted(() => ({ fitBounds: vi.fn(), setView: vi.fn(), flyTo: vi.fn(), once: vi.fn() }));
vi.mock("react-leaflet", () => ({
  MapContainer: ({ children }: { children: ReactNode }) => <div data-testid="mapa">{children}</div>,
  TileLayer: () => null,
  CircleMarker: () => null,
  Marker: ({ children }: { children: ReactNode }) => <div data-testid="marcador">{children}</div>,
  Popup: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  useMap: () => camera,
}));

const api = (proximos: unknown = pontos) => simularApi({ "/materiais": materiais, "/pontos/proximos": proximos });

describe("Mapa", () => {
  it("lista os pontos com distância e marca cada um no mapa", async () => {
    api();
    renderizarNaRota(<Mapa />, "/mapa");

    const lista = await screen.findByRole("list");
    expect(within(lista).getAllByRole("listitem")).toHaveLength(2);
    expect(within(lista).getByText("850 m")).toBeInTheDocument();
    expect(within(lista).getByText("3,3 km")).toBeInTheDocument();
    expect(screen.getAllByTestId("marcador")).toHaveLength(2);
    expect(screen.getByText(/2 pontos encontrados/)).toBeInTheDocument();
  });

  it("começa pelo centro de Araçatuba com raio de 10 km", async () => {
    const fetch = api();
    renderizarNaRota(<Mapa />, "/mapa");
    await screen.findByRole("list");

    expect(chamadas(fetch)).toContain("/v1/pontos/proximos?lat=-21.2089&lng=-50.4329&raio=10000");
    expect(screen.getByText(/a partir do centro de Araçatuba/)).toBeInTheDocument();
  });

  it("enquadra todos os pontos encontrados", async () => {
    api();
    renderizarNaRota(<Mapa />, "/mapa");
    await screen.findByRole("list");

    await waitFor(() => expect(camera.fitBounds).toHaveBeenCalled());
  });

  it("aplica o filtro de material da URL (vindo do guia)", async () => {
    const fetch = api();
    renderizarNaRota(<Mapa />, "/mapa?materialId=20&raio=25000");
    await screen.findByRole("list");

    expect(chamadas(fetch)).toContain("/v1/pontos/proximos?lat=-21.2089&lng=-50.4329&raio=25000&materialId=20");
    await waitFor(() => expect(screen.getByLabelText("Material")).toHaveValue("20"));
  });

  it("ignora raio fora das opções e usa o padrão", async () => {
    const fetch = api();
    renderizarNaRota(<Mapa />, "/mapa?raio=999999");
    await screen.findByRole("list");

    expect(chamadas(fetch).some(u => u.includes("raio=10000"))).toBe(true);
  });

  it("grava os filtros escolhidos na URL", async () => {
    api();
    renderizarNaRota(<Mapa />, "/mapa");
    await screen.findByRole("list");

    await userEvent.selectOptions(screen.getByLabelText("Distância"), "5000");
    await userEvent.selectOptions(screen.getByLabelText("Material"), "10");

    expect(screen.getByTestId("url")).toHaveTextContent("raio=5000");
    expect(screen.getByTestId("url")).toHaveTextContent("materialId=10");
  });

  it("ao escolher um ponto na lista, destaca e leva o mapa até ele", async () => {
    api();
    renderizarNaRota(<Mapa />, "/mapa");

    await userEvent.click(await screen.findByRole("button", { name: /Ecoponto Norte, 3,3 km/ }));

    expect(screen.getByRole("button", { name: /Ecoponto Norte/ }).closest("li")).toHaveClass("selecionado");
    expect(camera.flyTo).toHaveBeenCalledWith([-21.18, -50.44], 16, expect.anything());
  });

  it("oferece aumentar o raio quando não há pontos", async () => {
    const fetch = api((url: URL) => (url.searchParams.get("raio") === "25000" ? pontos : []));
    renderizarNaRota(<Mapa />, "/mapa");

    await userEvent.click(await screen.findByRole("button", { name: "Buscar até 25,0 km" }));

    expect(await screen.findAllByText("Coletor de pilhas")).not.toHaveLength(0);
    expect(chamadas(fetch).some(u => u.includes("raio=25000"))).toBe(true);
  });

  it("usa a localização do usuário quando permitida", async () => {
    const fetch = api();
    vi.stubGlobal("navigator", { geolocation: {
      getCurrentPosition: (ok: PositionCallback) => ok({ coords: { latitude: -21.1, longitude: -50.3 } } as GeolocationPosition),
    } });
    renderizarNaRota(<Mapa />, "/mapa");
    await screen.findByRole("list");

    await userEvent.click(screen.getByRole("button", { name: /Usar minha localização/ }));

    expect(await screen.findByText(/a partir da sua localização/)).toBeInTheDocument();
    expect(chamadas(fetch)).toContain("/v1/pontos/proximos?lat=-21.1&lng=-50.3&raio=10000");
  });

  it("explica quando a localização é negada e continua pelo centro", async () => {
    api();
    vi.stubGlobal("navigator", { geolocation: {
      getCurrentPosition: (_: PositionCallback, erro: PositionErrorCallback) => erro({ code: 1 } as GeolocationPositionError),
    } });
    renderizarNaRota(<Mapa />, "/mapa");
    await screen.findByRole("list");

    await userEvent.click(screen.getByRole("button", { name: /Usar minha localização/ }));

    expect(await screen.findByText(/permissão negada/)).toBeInTheDocument();
    expect(screen.getAllByText("Coletor de pilhas")).not.toHaveLength(0);
  });

  it("mostra erro com opção de tentar de novo", async () => {
    let falhar = true;
    api(() => (falhar ? falha() : pontos));
    renderizarNaRota(<Mapa />, "/mapa");

    const alerta = await screen.findByRole("alert");
    falhar = false;
    await userEvent.click(within(alerta).getByRole("button", { name: /Tentar de novo/ }));

    expect(await screen.findAllByText("Coletor de pilhas")).not.toHaveLength(0);
  });

  it("oferece rota pelo Google Maps e pelo Waze, em nova aba", async () => {
    api();
    renderizarNaRota(<Mapa />, "/mapa");
    await screen.findByRole("list");

    const google = screen.getByRole("link", { name: "Rota até Coletor de pilhas no Google Maps" });
    expect(google).toHaveAttribute("href", "https://www.google.com/maps/dir/?api=1&destination=-21.2,-50.44");
    expect(google).toHaveAttribute("target", "_blank");
    expect(google).toHaveAttribute("rel", "noreferrer");
    const waze = screen.getByRole("link", { name: "Rota até Coletor de pilhas no Waze" });
    expect(waze).toHaveAttribute("href", "https://waze.com/ul?ll=-21.2,-50.44&navigate=yes");
  });

  it("busca a partir de um endereço ou CEP digitado", async () => {
    const fetch = simularApi({
      "/materiais": materiais, "/pontos/proximos": pontos,
      "/localizacao": [{ descricao: "Rua Tiradentes, Araçatuba - SP", lat: -21.21, lng: -50.45 }],
    });
    renderizarNaRota(<Mapa />, "/mapa");
    await screen.findByRole("list");

    await userEvent.type(screen.getByLabelText(/endereço ou CEP/), "16010-000");
    await userEvent.click(screen.getByRole("button", { name: "Buscar" }));

    expect(await screen.findByText(/Mostrando a partir de: Rua Tiradentes/)).toBeInTheDocument();
    await waitFor(() => expect(chamadas(fetch)).toContain("/v1/pontos/proximos?lat=-21.21&lng=-50.45&raio=10000"));
    expect(chamadas(fetch)).toContain("/v1/localizacao?endereco=16010-000");
  });

  it("avisa quando o endereço não é encontrado", async () => {
    simularApi({ "/materiais": materiais, "/pontos/proximos": pontos, "/localizacao": [] });
    renderizarNaRota(<Mapa />, "/mapa");
    await screen.findByRole("list");

    await userEvent.type(screen.getByLabelText(/endereço ou CEP/), "Rua que não existe");
    await userEvent.click(screen.getByRole("button", { name: "Buscar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Endereço não encontrado");
  });

  it("envia aviso de informação errada sobre um ponto", async () => {
    const fetch = simularApi({ "/materiais": materiais, "/pontos/proximos": pontos, "/pontos/a/reportes": new Response(null, { status: 201 }) });
    renderizarNaRota(<Mapa />, "/mapa");
    const lista = await screen.findByRole("list");

    await userEvent.click(within(lista).getAllByRole("button", { name: /Informar erro/ })[0]);
    await userEvent.click(screen.getByRole("button", { name: "Enviar aviso" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Escolha o que está errado");

    await userEvent.click(screen.getByLabelText(/fechou ou não existe/));
    await userEvent.click(screen.getByRole("button", { name: "Enviar aviso" }));

    expect(await screen.findByText(/Obrigado! Vamos conferir/)).toBeInTheDocument();
    const envio = fetch.mock.calls.find(([u]) => String(u).endsWith("/pontos/a/reportes"))!;
    expect(envio[1]).toMatchObject({ method: "POST", body: JSON.stringify({ motivo: "Fechado" }) });
  });
});
