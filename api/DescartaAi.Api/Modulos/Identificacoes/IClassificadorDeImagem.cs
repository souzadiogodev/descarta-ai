namespace DescartaAi.Api.Modulos.Identificacoes;

/// <summary>Item do catálogo oferecido ao classificador: ele só pode responder com estes ids.</summary>
public record OpcaoCatalogo(int Id, string Nome, string Categoria);

public record Classificacao(int MaterialId, decimal Confianca);

/// <summary>
/// Reconhece o resíduo na foto. A implementação (hoje o Gemini) é trocável: a API só confia
/// em ids que existem no catálogo, e o usuário sempre confirma antes de ver o destino.
/// </summary>
public interface IClassificadorDeImagem
{
    /// <exception cref="ClassificadorIndisponivelException">Serviço de IA fora do ar ou não configurado.</exception>
    Task<IReadOnlyList<Classificacao>> ClassificarAsync(
        byte[] imagem, string tipoMime, IReadOnlyList<OpcaoCatalogo> catalogo, CancellationToken ct);
}

public class ClassificadorIndisponivelException(string mensagem, Exception? interna = null)
    : Exception(mensagem, interna);
