import { Linking } from "react-native";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { api, ErroApi } from "../api";
import Ponto from "./Ponto";

jest.mock("../api", () => {
  const real = jest.requireActual("../api");
  return { ...real, api: { ...real.api, reportar: jest.fn() } };
});

const reportar = api.reportar as jest.Mock;
const ponto = {
  id: "abc", nome: "Coletor de pilhas", endereco: "Av. Brasil", distanciaMetros: 1500,
  lat: -21.2, lng: -50.44, materiais: ["Pilha comum e alcalina"],
};
const renderizar = () =>
  render(<Ponto navigation={{} as never} route={{ key: "p", name: "Ponto", params: { ponto } } as never} />);

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Linking, "openURL").mockResolvedValue(undefined);
});

it("abre a rota no Google Maps ou no Waze", async () => {
  await renderizar();

  await fireEvent.press(screen.getByText("Abrir no Google Maps"));
  await fireEvent.press(screen.getByText("Abrir no Waze"));

  expect(Linking.openURL).toHaveBeenNthCalledWith(1, "https://www.google.com/maps/dir/?api=1&destination=-21.2,-50.44");
  expect(Linking.openURL).toHaveBeenNthCalledWith(2, "https://waze.com/ul?ll=-21.2,-50.44&navigate=yes");
});

it("envia aviso de informação errada só depois de escolher o motivo", async () => {
  reportar.mockResolvedValue(undefined);
  await renderizar();

  await fireEvent.press(screen.getByText(/Alguma informação está errada/));
  await fireEvent.press(screen.getByText("Enviar aviso"));
  expect(screen.getByText("Escolha o que está errado.")).toBeTruthy();
  expect(reportar).not.toHaveBeenCalled();

  await fireEvent.press(screen.getByText("Não aceita algum material listado"));
  await fireEvent.changeText(screen.getByLabelText("Detalhes do problema"), "  Só aceita pilha AA  ");
  await fireEvent.press(screen.getByText("Enviar aviso"));

  expect(await screen.findByText("Obrigado! Vamos conferir a informação.")).toBeTruthy();
  expect(reportar).toHaveBeenCalledWith("abc", "NaoAceitaMaterial", "Só aceita pilha AA");
});

it("pede detalhes quando o motivo é 'Outro' e avisa excesso de envios", async () => {
  reportar.mockRejectedValue(new ErroApi(429));
  await renderizar();

  await fireEvent.press(screen.getByText(/Alguma informação está errada/));
  await fireEvent.press(screen.getByText("Outro problema"));
  await fireEvent.press(screen.getByText("Enviar aviso"));
  expect(screen.getByText("Conte o que está errado.")).toBeTruthy();

  await fireEvent.changeText(screen.getByLabelText("Detalhes do problema"), "Mudou de lugar");
  await fireEvent.press(screen.getByText("Enviar aviso"));

  expect(await screen.findByText(/Muitos avisos em pouco tempo/)).toBeTruthy();
});
