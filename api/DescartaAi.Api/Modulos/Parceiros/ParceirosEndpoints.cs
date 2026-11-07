using System.Security.Claims;
using DescartaAi.Api.Dados;
using DescartaAi.Api.Dominio;
using DescartaAi.Api.Infraestrutura;
using DescartaAi.Api.Modulos.Contas;
using Microsoft.EntityFrameworkCore;
using NetTopologySuite.Geometries;

namespace DescartaAi.Api.Modulos.Parceiros;

/// <summary>Dados de um ponto enviados pelo parceiro (cadastro e edição).</summary>
public record PontoEntradaDto(
    string? Nome, string? Endereco, string? Cidade, string? Uf, string? Cep,
    string? Telefone, string? Horario, double? Lat, double? Lng, int[]? MateriaisIds)
{
    public Dictionary<string, string[]> Validar()
    {
        var erros = new Dictionary<string, string[]>();
        if (string.IsNullOrWhiteSpace(Nome) || Nome.Trim().Length > 120) erros["nome"] = ["Informe o nome do ponto (até 120 caracteres)."];
        if (string.IsNullOrWhiteSpace(Endereco) || Endereco.Trim().Length > 200) erros["endereco"] = ["Informe o endereço (até 200 caracteres)."];
        if (string.IsNullOrWhiteSpace(Cidade) || Cidade.Trim().Length > 80) erros["cidade"] = ["Informe a cidade."];
        if (Uf is null || Uf.Trim().Length != 2 || !Uf.Trim().All(char.IsLetter)) erros["uf"] = ["Informe a UF com 2 letras."];
        if (ContasEndpoints.Limpar(Cep) is { } cep && !System.Text.RegularExpressions.Regex.IsMatch(cep, @"^\d{5}-?\d{3}$"))
            erros["cep"] = ["CEP no formato 00000-000."];
        if (ContasEndpoints.Limpar(Telefone) is { Length: > 20 }) erros["telefone"] = ["Telefone com até 20 caracteres."];
        if (ContasEndpoints.Limpar(Horario) is { Length: > 120 }) erros["horario"] = ["Horário com até 120 caracteres."];
        if (Lat is null or < -90 or > 90 || Lng is null or < -180 or > 180)
            erros["localizacao"] = ["Localize o endereço no mapa antes de salvar."];
        if (MateriaisIds is not { Length: > 0 }) erros["materiaisIds"] = ["Escolha pelo menos um material aceito."];
        return erros;
    }

    /// <summary>Copia os dados para a entidade e devolve o ponto à fila de aprovação.</summary>
    public void Aplicar(PontoDescarte p, IEnumerable<int> materiaisValidos)
    {
        p.Nome = Nome!.Trim();
        p.Endereco = Endereco!.Trim();
        p.Cidade = Cidade!.Trim();
        p.Uf = Uf!.Trim().ToUpperInvariant();
        p.Cep = ContasEndpoints.Limpar(Cep);
        p.Telefone = ContasEndpoints.Limpar(Telefone);
        p.Horario = ContasEndpoints.Limpar(Horario);
        p.Localizacao = new GeometryFactory(new PrecisionModel(), Srid.Wgs84).CreatePoint(new Coordinate(Lng!.Value, Lat!.Value));
        p.Status = StatusPonto.Pendente;
        p.AprovadoPor = null;
        p.AprovadoEm = null;
        p.AtualizadoEm = DateTime.UtcNow;
        p.Materiais.Clear();
        foreach (var id in materiaisValidos) p.Materiais.Add(new PontoMaterial { MaterialId = id });
    }
}

public record MeuPontoDto(
    Guid Id, string Nome, string Endereco, string Cidade, string Uf, string? Cep,
    string? Telefone, string? Horario, double Lat, double Lng, int[] MateriaisIds, string Status, DateTime AtualizadoEm);

public static class ParceirosEndpoints
{
    public static IEndpointRouteBuilder MapParceiros(this IEndpointRouteBuilder app)
    {
        var grupo = app.MapGroup("/parceiro/pontos").WithTags("Parceiro")
            .RequireAuthorization(Autenticacao.PoliticaParceiro);

        grupo.MapGet("", async (ClaimsPrincipal u, AppDbContext db, CancellationToken ct) =>
        {
            var parceiroId = u.ParceiroId();
            var pontos = await db.Pontos.AsNoTracking()
                .Where(p => p.ParceiroId == parceiroId)
                .OrderByDescending(p => p.AtualizadoEm)
                .Select(p => new
                {
                    p.Id, p.Nome, p.Endereco, p.Cidade, p.Uf, p.Cep, p.Telefone, p.Horario, p.Localizacao,
                    Materiais = p.Materiais.Select(m => m.MaterialId).ToArray(), p.Status, p.AtualizadoEm
                })
                .ToListAsync(ct);
            return Results.Ok(pontos.Select(p => new MeuPontoDto(p.Id, p.Nome, p.Endereco, p.Cidade, p.Uf, p.Cep,
                p.Telefone, p.Horario, p.Localizacao.Y, p.Localizacao.X, p.Materiais, p.Status.ToString(), p.AtualizadoEm)));
        });

        // RF15: o ponto novo entra como Pendente e só aparece ao público após aprovação (RN01).
        grupo.MapPost("", async (PontoEntradaDto dto, ClaimsPrincipal u, AppDbContext db, CancellationToken ct) =>
        {
            var (erros, materiais) = await ValidarAsync(dto, db, ct);
            if (erros.Count > 0) return Results.ValidationProblem(erros);

            var ponto = new PontoDescarte { ParceiroId = u.ParceiroId() };
            dto.Aplicar(ponto, materiais);
            db.Pontos.Add(ponto);
            await db.SaveChangesAsync(ct);
            return Results.Created($"/v1/parceiro/pontos/{ponto.Id}", new { ponto.Id, Status = ponto.Status.ToString() });
        });

        // RN08: o parceiro só edita os pontos que cadastrou. Editar devolve o ponto à aprovação.
        grupo.MapPut("/{id:guid}", async (Guid id, PontoEntradaDto dto, ClaimsPrincipal u, AppDbContext db, CancellationToken ct) =>
        {
            var parceiroId = u.ParceiroId();
            var ponto = await db.Pontos.Include(p => p.Materiais)
                .FirstOrDefaultAsync(p => p.Id == id && p.ParceiroId == parceiroId, ct);
            if (ponto is null)
                return Results.Problem(statusCode: StatusCodes.Status404NotFound, title: "Ponto não encontrado");

            var (erros, materiais) = await ValidarAsync(dto, db, ct);
            if (erros.Count > 0) return Results.ValidationProblem(erros);

            dto.Aplicar(ponto, materiais);
            await db.SaveChangesAsync(ct);
            return Results.Ok(new { ponto.Id, Status = ponto.Status.ToString() });
        });

        return app;
    }

    private static async Task<(Dictionary<string, string[]>, List<int>)> ValidarAsync(
        PontoEntradaDto dto, AppDbContext db, CancellationToken ct)
    {
        var erros = dto.Validar();
        var pedidos = (dto.MateriaisIds ?? []).Distinct().ToList();
        var existentes = await db.Materiais.Where(m => pedidos.Contains(m.Id)).Select(m => m.Id).ToListAsync(ct);
        if (pedidos.Count > 0 && existentes.Count != pedidos.Count)
            erros["materiaisIds"] = ["Algum material escolhido não existe."];
        return (erros, existentes);
    }
}
