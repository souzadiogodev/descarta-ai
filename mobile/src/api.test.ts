import { api, consulta, ErroApi, formatarDistancia } from "./api";

const resposta = (status: number, corpo: unknown = {}) =>
  ({ ok: status < 400, status, json: async () => corpo }) as Response;

let fetchMock: jest.Mock;
beforeEach(() => {
  fetchMock = jest.fn();
  global.fetch = fetchMock;
});

describe("consulta", () => {
  it("monta a query ignorando valores vazios e codificando acentos", () => {
    expect(consulta({ busca: "óleo de cozinha", categoriaId: undefined, vazio: "" }))
      .toBe("?busca=%C3%B3leo%20de%20cozinha");
  });
  it("devolve texto vazio sem parâmetros", () => {
    expect(consulta({})).toBe("");
  });
});

describe("formatarDistancia", () => {
  it.each([[350.4, "350 m"], [999, "999 m"], [1000, "1,0 km"], [12345, "12,3 km"]])("%p → %p", (m, texto) => {
    expect(formatarDistancia(m)).toBe(texto);
  });
});

describe("api", () => {
  it("consulta pontos próximos com os filtros", async () => {
    fetchMock.mockResolvedValue(resposta(200, []));
    await api.proximos({ lat: -21.2, lng: -50.4, raio: 10, materialId: 3 });
    expect(fetchMock.mock.calls[0][0]).toMatch(/\/pontos\/proximos\?lat=-21.2&lng=-50.4&raio=10&materialId=3$/);
  });

  it("erro HTTP vira ErroApi com o código", async () => {
    fetchMock.mockResolvedValue(resposta(503));
    await expect(api.categorias()).rejects.toEqual(expect.objectContaining({ status: 503 }));
    await expect(api.categorias()).rejects.toBeInstanceOf(ErroApi);
  });

  it("envia a foto como multipart no campo foto", async () => {
    fetchMock.mockResolvedValue(resposta(200, { id: 1, sugestoes: [] }));
    const r = await api.identificar({ uri: "file:///foto.jpg", tipo: "image/jpeg", nome: "foto.jpg" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/identificacoes$/);
    expect(init.method).toBe("POST");
    expect(init.body).toBeInstanceOf(FormData);
    expect(init.headers).toBeUndefined(); // o boundary do multipart é definido pelo próprio fetch
    expect(r).toEqual({ id: 1, sugestoes: [] });
  });

  it("confirma o material com PATCH em JSON", async () => {
    fetchMock.mockResolvedValue(resposta(204));
    await api.confirmar(7, 3);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/identificacoes\/7$/);
    expect(init).toMatchObject({ method: "PATCH", body: JSON.stringify({ materialId: 3 }) });
  });
});
