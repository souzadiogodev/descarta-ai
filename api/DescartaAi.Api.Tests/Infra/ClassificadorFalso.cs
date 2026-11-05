using DescartaAi.Api.Modulos.Identificacoes;

namespace DescartaAi.Api.Tests.Infra;

/// <summary>Substitui o Gemini nos testes: devolve o que o cenário pedir, sem rede.</summary>
public sealed class ClassificadorFalso : IClassificadorDeImagem
{
    public Func<IReadOnlyList<OpcaoCatalogo>, IReadOnlyList<Classificacao>> Responder { get; set; } = _ => [];
    public bool Indisponivel { get; set; }
    public int Chamadas { get; private set; }

    public Task<IReadOnlyList<Classificacao>> ClassificarAsync(
        byte[] imagem, string tipoMime, IReadOnlyList<OpcaoCatalogo> catalogo, CancellationToken ct)
    {
        Chamadas++;
        if (Indisponivel) throw new ClassificadorIndisponivelException("fora do ar");
        return Task.FromResult(Responder(catalogo));
    }
}
