using DescartaAi.Api.Tests.Infra;
using Microsoft.AspNetCore.Hosting;

namespace DescartaAi.Api.Tests.Integracao;

[Collection(ColecaoApi.Nome)]
public sealed class SaudeTests(BancoPostgis banco)
{
    [Fact]
    public async Task Health_responde_Healthy_quando_o_banco_esta_acessivel()
    {
        using var api = new ApiFactory(banco.ConnectionString);

        var resposta = await api.CreateClient().GetAsync("/health");

        resposta.EnsureSuccessStatusCode();
        Assert.Equal("Healthy", await resposta.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task Health_responde_503_quando_o_banco_cai()
    {
        // Porta sem banco: a API sobe (sem migrar) e o health check acusa a falha.
        using var api = new ApiFactory("Host=127.0.0.1;Port=1;Database=x;Username=x;Password=x;Timeout=2");
        var cliente = api.WithWebHostBuilder(b => b.UseSetting("Banco:MigrarAoIniciar", "false")).CreateClient();

        var resposta = await cliente.GetAsync("/health");

        Assert.Equal(System.Net.HttpStatusCode.ServiceUnavailable, resposta.StatusCode);
    }
}
