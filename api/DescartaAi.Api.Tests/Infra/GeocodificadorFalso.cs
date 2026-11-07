using DescartaAi.Api.Modulos.Localizacao;

namespace DescartaAi.Api.Tests.Infra;

public sealed class GeocodificadorFalso : IGeocodificador
{
    public bool Indisponivel { get; set; }
    public string? UltimaBusca { get; private set; }

    public Task<IReadOnlyList<LocalDto>> BuscarAsync(string texto, CancellationToken ct)
    {
        UltimaBusca = texto;
        if (Indisponivel) throw new GeocodificadorIndisponivelException("fora do ar");
        IReadOnlyList<LocalDto> r = [new("Rua Teste, Araçatuba - SP", -21.2089, -50.4329)];
        return Task.FromResult(r);
    }
}
