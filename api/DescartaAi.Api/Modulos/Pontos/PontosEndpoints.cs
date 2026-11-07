using DescartaAi.Api.Dados;
using DescartaAi.Api.Dominio;
using DescartaAi.Api.Infraestrutura;
using DescartaAi.Api.Modulos.Contas;
using Microsoft.EntityFrameworkCore;

namespace DescartaAi.Api.Modulos.Pontos;

public record ReporteEntradaDto(string? Motivo, string? Comentario);

public static class PontosEndpoints
{
    public const int ComentarioMaximo = 500;

    public static IEndpointRouteBuilder MapPontos(this IEndpointRouteBuilder app)
    {
        var grupo = app.MapGroup("/pontos").WithTags("Pontos");

        grupo.MapGet("/proximos", async (double? lat, double? lng, double? raio, int? materialId,
            IPontosServico servico, AppDbContext db, CancellationToken ct) =>
        {
            var filtro = new FiltroProximidade(lat, lng, raio, materialId);
            var erros = filtro.Validar();
            if (erros.Count > 0) return Results.ValidationProblem(erros);

            var pontos = await servico.BuscarProximosAsync(filtro, ct);
            // RF21: conta a busca para o painel, sem guardar a localização de quem buscou.
            db.Buscas.Add(new Busca { MaterialId = materialId is { } m && await db.Materiais.AnyAsync(x => x.Id == m, ct) ? m : null });
            await db.SaveChangesAsync(ct);
            return Results.Ok(pontos);
        });

        grupo.MapGet("/{id:guid}", async (Guid id, IPontosServico servico, CancellationToken ct) =>
            await servico.ObterAprovadoAsync(id, ct) is { } ponto
                ? Results.Ok(ponto)
                : Results.Problem(statusCode: StatusCodes.Status404NotFound, title: "Ponto não encontrado"));

        // RF19: qualquer pessoa pode avisar que a informação de um ponto está errada.
        grupo.MapPost("/{id:guid}/reportes", async (Guid id, ReporteEntradaDto dto, AppDbContext db, CancellationToken ct) =>
        {
            if (!Enum.TryParse<MotivoReporte>(dto.Motivo, out var motivo))
                return Results.ValidationProblem(new Dictionary<string, string[]>
                    { ["motivo"] = ["Escolha um motivo: Fechado, EnderecoErrado, NaoAceitaMaterial ou Outro."] });
            var comentario = ContasEndpoints.Limpar(dto.Comentario);
            if (comentario is { Length: > ComentarioMaximo })
                return Results.ValidationProblem(new Dictionary<string, string[]>
                    { ["comentario"] = [$"Comentário com até {ComentarioMaximo} caracteres."] });
            if (motivo == MotivoReporte.Outro && comentario is null)
                return Results.ValidationProblem(new Dictionary<string, string[]>
                    { ["comentario"] = ["Conte o que está errado."] });
            if (!await db.Pontos.AnyAsync(p => p.Id == id && p.Status == StatusPonto.Aprovado, ct))
                return Results.Problem(statusCode: StatusCodes.Status404NotFound, title: "Ponto não encontrado");

            db.Reportes.Add(new Reporte { PontoId = id, Motivo = motivo, Comentario = comentario });
            await db.SaveChangesAsync(ct);
            return Results.StatusCode(StatusCodes.Status201Created);
        }).RequireRateLimiting(Seguranca.PoliticaReporte);

        return app;
    }
}
