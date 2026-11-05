import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { api } from "../api";
import Guia from "./Guia";

jest.mock("../api", () => {
  const real = jest.requireActual("../api");
  return { ...real, api: { ...real.api, categorias: jest.fn(), materiais: jest.fn() } };
});

const categorias = api.categorias as jest.Mock;
const materiais = api.materiais as jest.Mock;
const navigation = { navigate: jest.fn() };
const renderizar = (busca?: string) =>
  render(<Guia navigation={navigation as never} route={{ key: "g", name: "Guia", params: { busca } } as never} />);

beforeEach(() => {
  jest.clearAllMocks();
  categorias.mockResolvedValue([{ id: 1, nome: "Lâmpadas" }]);
  materiais.mockResolvedValue([
    { id: 5, categoriaId: 1, categoria: "Lâmpadas", nome: "Lâmpada fluorescente", perigoso: true },
  ]);
});

it("lista os materiais, marca os perigosos e abre o detalhe", async () => {
  await renderizar();

  await fireEvent.press(await screen.findByText("Lâmpada fluorescente"));

  expect(screen.getByText("Lâmpadas · Resíduo perigoso")).toBeTruthy();
  expect(navigation.navigate).toHaveBeenCalledWith("Material", { id: 5, nome: "Lâmpada fluorescente" });
});

it("usa a busca vinda da tela inicial", async () => {
  await renderizar("pilha");
  await screen.findByText("Lâmpada fluorescente");
  expect(materiais).toHaveBeenCalledWith({ busca: "pilha", categoriaId: undefined }, expect.anything());
});

it("filtra por categoria", async () => {
  await renderizar();
  await fireEvent.press(await screen.findByText("Lâmpadas"));
  await screen.findByText("Lâmpada fluorescente");
  expect(materiais).toHaveBeenLastCalledWith({ busca: "", categoriaId: 1 }, expect.anything());
});

it("espera parar de digitar antes de buscar", async () => {
  jest.useFakeTimers();
  try {
    await renderizar();
    await act(async () => {});
    const chamadas = materiais.mock.calls.length;

    await fireEvent.changeText(screen.getByLabelText("Buscar item"), "ol");
    await fireEvent.changeText(screen.getByLabelText("Buscar item"), "oleo");
    expect(materiais).toHaveBeenCalledTimes(chamadas);

    await act(async () => { jest.advanceTimersByTime(300); });
    expect(materiais).toHaveBeenLastCalledWith({ busca: "oleo", categoriaId: undefined }, expect.anything());
  } finally {
    jest.useRealTimers();
  }
});

it("lista vazia mostra orientação", async () => {
  materiais.mockResolvedValue([]);
  await renderizar();
  expect(await screen.findByText(/Nenhum item encontrado/)).toBeTruthy();
});

it("erro mostra 'Tentar de novo' e refaz a consulta", async () => {
  materiais.mockRejectedValueOnce(new Error("rede"));
  await renderizar();

  await fireEvent.press(await screen.findByText("Tentar de novo"));

  expect(await screen.findByText("Lâmpada fluorescente")).toBeTruthy();
});
