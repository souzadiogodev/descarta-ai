namespace DescartaAi.Api.Modulos.Identificacoes;

public record SugestaoDto(int MaterialId, string Nome, string Categoria, bool Perigoso, decimal Confianca);

public record IdentificacaoDto(long Id, IReadOnlyList<SugestaoDto> Sugestoes);

/// <summary>Material que o usuário confirmou (a sugestão ou uma correção).</summary>
public record ConfirmacaoDto(int MaterialId);
