import { fireEvent, render, screen } from "@testing-library/react-native";
import * as ImagePicker from "expo-image-picker";
import { api, ErroApi } from "../api";
import Foto, { mensagemDeErro, porcentagem } from "./Foto";

jest.mock("expo-image-picker", () => ({
  requestCameraPermissionsAsync: jest.fn(),
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));

jest.mock("expo-image-manipulator", () => {
  const contexto = {
    resize: jest.fn(),
    renderAsync: jest.fn(async () => ({ saveAsync: async () => ({ uri: "file:///reduzida.jpg" }) })),
  };
  return { SaveFormat: { JPEG: "jpeg" }, ImageManipulator: { manipulate: jest.fn(() => contexto) }, __contexto: contexto };
});

jest.mock("../api", () => {
  const real = jest.requireActual("../api");
  return { ...real, api: { ...real.api, identificar: jest.fn(), confirmar: jest.fn(async () => undefined) } };
});

const picker = ImagePicker as jest.Mocked<typeof ImagePicker>;
const identificar = api.identificar as jest.Mock;
const confirmar = api.confirmar as jest.Mock;
const { __contexto: contexto } = jest.requireMock("expo-image-manipulator");

const navigation = { navigate: jest.fn(), replace: jest.fn() };
const renderizar = () => render(<Foto navigation={navigation as never} route={{ key: "f", name: "Foto" } as never} />);

const foto = { uri: "file:///original.jpg", width: 4000, height: 3000 };

beforeEach(() => {
  jest.clearAllMocks();
  picker.requestCameraPermissionsAsync.mockResolvedValue({ granted: true } as never);
  picker.launchCameraAsync.mockResolvedValue({ canceled: false, assets: [foto] } as never);
});

it("mostra o aviso de privacidade antes de enviar", async () => {
  await renderizar();
  expect(screen.getByText(/não é guardada/)).toBeTruthy();
});

it("sem permissão da câmera, avisa e não abre a câmera", async () => {
  picker.requestCameraPermissionsAsync.mockResolvedValue({ granted: false } as never);
  await renderizar();

  await fireEvent.press(screen.getByText("Tirar foto"));

  expect(await screen.findByText(/Sem acesso à câmera/)).toBeTruthy();
  expect(picker.launchCameraAsync).not.toHaveBeenCalled();
});

it("reduz a foto, envia, mostra as sugestões e confirma a escolhida", async () => {
  identificar.mockResolvedValue({
    id: 42,
    sugestoes: [
      { materialId: 3, nome: "Pilha comum e alcalina", categoria: "Pilhas e baterias", perigoso: true, confianca: 0.92 },
      { materialId: 8, nome: "Bateria de celular", categoria: "Pilhas e baterias", perigoso: true, confianca: 0.4 },
    ],
  });
  await renderizar();

  await fireEvent.press(screen.getByText("Tirar foto"));
  await fireEvent.press(await screen.findByText("Pilha comum e alcalina"));

  expect(contexto.resize).toHaveBeenCalledWith({ width: 1280 });
  expect(identificar.mock.calls[0][0]).toEqual({ uri: "file:///reduzida.jpg", tipo: "image/jpeg", nome: "foto.jpg" });
  expect(screen.getByText("92%")).toBeTruthy();
  expect(confirmar).toHaveBeenCalledWith(42, 3);
  expect(navigation.replace).toHaveBeenCalledWith("Material", { id: 3, nome: "Pilha comum e alcalina" });
});

it("sem sugestões, oferece buscar pelo nome", async () => {
  identificar.mockResolvedValue({ id: 1, sugestoes: [] });
  await renderizar();

  await fireEvent.press(screen.getByText("Tirar foto"));
  await fireEvent.press(await screen.findByText("Buscar pelo nome"));

  expect(navigation.navigate).toHaveBeenCalledWith("Abas", { screen: "Guia" });
});

it("IA indisponível mostra mensagem e permite tentar de novo", async () => {
  identificar.mockRejectedValue(new ErroApi(503));
  await renderizar();

  await fireEvent.press(screen.getByText("Tirar foto"));
  expect(await screen.findByText(/indisponível agora/)).toBeTruthy();

  await fireEvent.press(screen.getByText("Tentar outra foto"));
  expect(screen.getByText("Tirar foto")).toBeTruthy();
});

it("cancelar a câmera não envia nada", async () => {
  picker.launchCameraAsync.mockResolvedValue({ canceled: true, assets: null } as never);
  await renderizar();

  await fireEvent.press(screen.getByText("Tirar foto"));
  await screen.findByText("Tirar foto");

  expect(identificar).not.toHaveBeenCalled();
});

describe("textos", () => {
  it.each([
    [new ErroApi(429), /Aguarde um minuto/],
    [new ErroApi(413), /grande demais/],
    [new ErroApi(400), /não suportado/],
    [new TypeError("Network request failed"), /Verifique sua conexão/],
  ])("%p", (erro, texto) => expect(mensagemDeErro(erro)).toMatch(texto));

  it("confiança em porcentagem", () => expect(porcentagem(0.456)).toBe("46%"));
});
