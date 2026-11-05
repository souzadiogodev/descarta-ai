using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using DescartaAi.Api.Modulos.Identificacoes;
using DescartaAi.Api.Tests.Infra;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace DescartaAi.Api.Tests.Integracao;

[Collection(ColecaoApi.Nome)]
public sealed class IdentificacoesTests(BancoPostgis banco) : IDisposable
{
    private static readonly byte[] Jpeg = [0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46];

    private readonly ClassificadorFalso _ia = new();
    private ApiFactory? _api;

    public void Dispose() => _api?.Dispose();

    private HttpClient Cliente(int identificacoesPorMinuto = 1000)
    {
        _api = new ApiFactory(banco.ConnectionString);
        return _api.WithWebHostBuilder(b =>
        {
            b.UseSetting("Limite:IdentificacoesPorMinuto", identificacoesPorMinuto.ToString());
            b.ConfigureTestServices(s => s.AddSingleton<IClassificadorDeImagem>(_ia));
        }).CreateClient();
    }

    private static MultipartFormDataContent Foto(byte[] bytes, string campo = "foto")
    {
        var arquivo = new ByteArrayContent(bytes);
        arquivo.Headers.ContentType = new MediaTypeHeaderValue("image/jpeg");
        return new MultipartFormDataContent { { arquivo, campo, "foto.jpg" } };
    }

    private static int IdDe(IReadOnlyList<OpcaoCatalogo> catalogo, string nome) =>
        catalogo.Single(m => m.Nome == nome).Id;

    [Fact]
    public async Task Devolve_sugestoes_do_catalogo_ordenadas_por_confianca_e_registra_a_identificacao()
    {
        _ia.Responder = c =>
        [
            new(IdDe(c, "Lâmpada fluorescente"), 0.3m),
            new(IdDe(c, "Pilha comum e alcalina"), 0.92m),
        ];
        var cliente = Cliente();

        var resposta = await cliente.PostAsync("/v1/identificacoes", Foto(Jpeg));

        resposta.EnsureSuccessStatusCode();
        var corpo = await resposta.Content.ReadFromJsonAsync<IdentificacaoDto>();
        Assert.Equal(["Pilha comum e alcalina", "Lâmpada fluorescente"], corpo!.Sugestoes.Select(s => s.Nome));
        Assert.True(corpo.Sugestoes[0].Perigoso);
        Assert.Equal(0.92m, corpo.Sugestoes[0].Confianca);

        await _api!.ComBancoAsync(async db =>
        {
            var registro = await db.Identificacoes.SingleAsync(i => i.Id == corpo.Id);
            Assert.Equal(corpo.Sugestoes[0].MaterialId, registro.MaterialSugeridoId);
            Assert.Null(registro.MaterialConfirmadoId);
        });
    }

    [Fact]
    public async Task Ignora_ids_inventados_pela_IA_e_limita_a_tres_sugestoes()
    {
        _ia.Responder = c => [new(999_999, 0.99m), .. c.Take(5).Select(m => new Classificacao(m.Id, 1.7m))];
        var cliente = Cliente();

        var corpo = await (await cliente.PostAsync("/v1/identificacoes", Foto(Jpeg)))
            .Content.ReadFromJsonAsync<IdentificacaoDto>();

        Assert.Equal(IdentificacoesServico.MaximoSugestoes, corpo!.Sugestoes.Count);
        Assert.DoesNotContain(corpo.Sugestoes, s => s.MaterialId == 999_999);
        Assert.All(corpo.Sugestoes, s => Assert.Equal(1m, s.Confianca));
    }

    [Fact]
    public async Task Arquivo_que_nao_e_imagem_retorna_400_sem_chamar_a_IA()
    {
        var cliente = Cliente();

        var resposta = await cliente.PostAsync("/v1/identificacoes", Foto("%PDF-1.7"u8.ToArray()));

        Assert.Equal(HttpStatusCode.BadRequest, resposta.StatusCode);
        Assert.Equal(0, _ia.Chamadas);
    }

    [Fact]
    public async Task Sem_o_campo_foto_retorna_400()
    {
        var resposta = await Cliente().PostAsync("/v1/identificacoes", Foto(Jpeg, campo: "imagem"));

        Assert.Equal(HttpStatusCode.BadRequest, resposta.StatusCode);
    }

    [Fact]
    public async Task Imagem_acima_de_5_MB_retorna_413()
    {
        var grande = new byte[IdentificacoesEndpoints.TamanhoMaximoBytes + 1];
        Jpeg.CopyTo(grande, 0);

        var resposta = await Cliente().PostAsync("/v1/identificacoes", Foto(grande));

        Assert.Equal(HttpStatusCode.RequestEntityTooLarge, resposta.StatusCode);
        Assert.Equal(0, _ia.Chamadas);
    }

    [Fact]
    public async Task IA_fora_do_ar_retorna_503()
    {
        _ia.Indisponivel = true;

        var resposta = await Cliente().PostAsync("/v1/identificacoes", Foto(Jpeg));

        Assert.Equal(HttpStatusCode.ServiceUnavailable, resposta.StatusCode);
        Assert.Equal("application/problem+json", resposta.Content.Headers.ContentType?.MediaType);
    }

    [Fact]
    public async Task Limita_identificacoes_por_IP()
    {
        var cliente = Cliente(identificacoesPorMinuto: 2);

        var codigos = new List<HttpStatusCode>();
        for (var i = 0; i < 3; i++)
            codigos.Add((await cliente.PostAsync("/v1/identificacoes", Foto(Jpeg))).StatusCode);

        Assert.Equal([HttpStatusCode.OK, HttpStatusCode.OK, HttpStatusCode.TooManyRequests], codigos);
    }

    [Fact]
    public async Task Confirmar_outro_material_marca_como_corrigido_e_nao_aceita_segunda_confirmacao()
    {
        int sugerido = 0, outro = 0;
        _ia.Responder = c =>
        {
            sugerido = IdDe(c, "Pilha comum e alcalina");
            outro = IdDe(c, "Lâmpada fluorescente");
            return [new(sugerido, 0.8m)];
        };
        var cliente = Cliente();
        var corpo = await (await cliente.PostAsync("/v1/identificacoes", Foto(Jpeg)))
            .Content.ReadFromJsonAsync<IdentificacaoDto>();

        var primeira = await cliente.PatchAsJsonAsync($"/v1/identificacoes/{corpo!.Id}", new ConfirmacaoDto(outro));
        var segunda = await cliente.PatchAsJsonAsync($"/v1/identificacoes/{corpo.Id}", new ConfirmacaoDto(sugerido));

        Assert.Equal(HttpStatusCode.NoContent, primeira.StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, segunda.StatusCode);
        await _api!.ComBancoAsync(async db =>
        {
            var registro = await db.Identificacoes.SingleAsync(i => i.Id == corpo.Id);
            Assert.Equal(outro, registro.MaterialConfirmadoId);
            Assert.True(registro.Corrigido);
        });
    }

    [Fact]
    public async Task Confirmar_identificacao_ou_material_inexistente_retorna_404_e_400()
    {
        var cliente = Cliente();
        var corpo = await (await cliente.PostAsync("/v1/identificacoes", Foto(Jpeg)))
            .Content.ReadFromJsonAsync<IdentificacaoDto>();

        var semIdentificacao = await cliente.PatchAsJsonAsync("/v1/identificacoes/999999999", new ConfirmacaoDto(1));
        var semMaterial = await cliente.PatchAsJsonAsync($"/v1/identificacoes/{corpo!.Id}", new ConfirmacaoDto(999_999));

        Assert.Equal(HttpStatusCode.NotFound, semIdentificacao.StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, semMaterial.StatusCode);
    }
}
