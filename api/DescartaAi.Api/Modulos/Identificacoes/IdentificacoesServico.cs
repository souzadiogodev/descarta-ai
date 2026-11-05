using DescartaAi.Api.Dados;
using DescartaAi.Api.Dominio;
using Microsoft.EntityFrameworkCore;

namespace DescartaAi.Api.Modulos.Identificacoes;

public enum ResultadoConfirmacao { Ok, NaoEncontrada, MaterialInexistente, JaConfirmada }

public interface IIdentificacoesServico
{
    Task<IdentificacaoDto> IdentificarAsync(byte[] imagem, string tipoMime, CancellationToken ct);
    Task<ResultadoConfirmacao> ConfirmarAsync(long id, int materialId, CancellationToken ct);
}

/// <summary>
/// A foto não é gravada: só a sugestão, a confiança e o que o usuário confirmou,
/// para medir a taxa de acerto da IA.
/// </summary>
public class IdentificacoesServico(AppDbContext db, IClassificadorDeImagem classificador) : IIdentificacoesServico
{
    public const int MaximoSugestoes = 3;

    public async Task<IdentificacaoDto> IdentificarAsync(byte[] imagem, string tipoMime, CancellationToken ct)
    {
        var materiais = await db.Materiais.AsNoTracking()
            .OrderBy(m => m.Nome)
            .Select(m => new { m.Id, m.Nome, Categoria = m.Categoria!.Nome, m.Perigoso })
            .ToListAsync(ct);

        var catalogo = materiais.Select(m => new OpcaoCatalogo(m.Id, m.Nome, m.Categoria)).ToList();
        var porId = materiais.ToDictionary(m => m.Id);

        var classificacoes = await classificador.ClassificarAsync(imagem, tipoMime, catalogo, ct);

        // Descarta ids inventados pela IA e repetidos; limita a confiança a [0, 1].
        var sugestoes = classificacoes
            .Where(c => porId.ContainsKey(c.MaterialId))
            .GroupBy(c => c.MaterialId)
            .Select(g => (Id: g.Key, Confianca: Math.Round(Math.Clamp(g.Max(c => c.Confianca), 0m, 1m), 2)))
            .OrderByDescending(s => s.Confianca)
            .Take(MaximoSugestoes)
            .Select(s =>
            {
                var m = porId[s.Id];
                return new SugestaoDto(m.Id, m.Nome, m.Categoria, m.Perigoso, s.Confianca);
            })
            .ToList();

        var registro = new Identificacao
        {
            MaterialSugeridoId = sugestoes.FirstOrDefault()?.MaterialId,
            Confianca = sugestoes.FirstOrDefault()?.Confianca,
        };
        db.Identificacoes.Add(registro);
        await db.SaveChangesAsync(ct);

        return new IdentificacaoDto(registro.Id, sugestoes);
    }

    public async Task<ResultadoConfirmacao> ConfirmarAsync(long id, int materialId, CancellationToken ct)
    {
        var registro = await db.Identificacoes.FirstOrDefaultAsync(i => i.Id == id, ct);
        if (registro is null) return ResultadoConfirmacao.NaoEncontrada;
        if (registro.MaterialConfirmadoId is not null) return ResultadoConfirmacao.JaConfirmada;
        if (!await db.Materiais.AnyAsync(m => m.Id == materialId, ct)) return ResultadoConfirmacao.MaterialInexistente;

        registro.MaterialConfirmadoId = materialId;
        registro.Corrigido = registro.MaterialSugeridoId != materialId;
        await db.SaveChangesAsync(ct);
        return ResultadoConfirmacao.Ok;
    }
}
