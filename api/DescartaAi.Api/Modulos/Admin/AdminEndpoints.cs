using System.Security.Claims;
using DescartaAi.Api.Dados;
using DescartaAi.Api.Dominio;
using DescartaAi.Api.Infraestrutura;
using DescartaAi.Api.Modulos.Contas;
using Microsoft.EntityFrameworkCore;

namespace DescartaAi.Api.Modulos.Admin;

public record PontoAdminDto(
    Guid Id, string Nome, string Endereco, string Cidade, string Uf, string? Cep, string? Telefone, string? Horario,
    double Lat, double Lng, string[] Materiais, string Status, string? Parceiro, DateTime AtualizadoEm, int ReportesPendentes);

public record MudarStatusDto(string? Status);

public record CategoriaEntradaDto(string? Nome, string? Icone, string? Cor);

public record MaterialEntradaDto(int? CategoriaId, string? Nome, string? Instrucoes, string? Cuidados, string[]? Sinonimos, bool Perigoso);

public record ReporteAdminDto(Guid Id, Guid PontoId, string Ponto, string Motivo, string? Comentario, string Status, DateTime CriadoEm);

public record EstatisticasDto(
    int Identificacoes, int IdentificacoesConfirmadas, int IdentificacoesCorrigidas, double? TaxaDeAcerto,
    int Buscas, Dictionary<string, int> PontosPorStatus, int Parceiros, int ReportesPendentes,
    IReadOnlyList<MaterialContagemDto> MateriaisMaisIdentificados);

public record MaterialContagemDto(string Material, int Quantidade);

public static class AdminEndpoints
{
    public static IEndpointRouteBuilder MapAdmin(this IEndpointRouteBuilder app)
    {
        var admin = app.MapGroup("/admin").WithTags("Administração")
            .RequireAuthorization(Autenticacao.PoliticaAdmin);

        // ---- RF16: aprovar, rejeitar ou desativar pontos ----
        admin.MapGet("/pontos", async (string? status, AppDbContext db, CancellationToken ct) =>
        {
            var consulta = db.Pontos.AsNoTracking();
            if (status is not null)
            {
                if (!Enum.TryParse<StatusPonto>(status, out var s))
                    return Results.ValidationProblem(new Dictionary<string, string[]> { ["status"] = ["Status inválido."] });
                consulta = consulta.Where(p => p.Status == s);
            }

            var linhas = await consulta
                .OrderByDescending(p => p.AtualizadoEm)
                .Take(500)
                .Select(p => new
                {
                    p.Id, p.Nome, p.Endereco, p.Cidade, p.Uf, p.Cep, p.Telefone, p.Horario, p.Localizacao, p.Status, p.AtualizadoEm,
                    Materiais = p.Materiais.Select(m => m.Material!.Nome).OrderBy(n => n).ToArray(),
                    Parceiro = p.Parceiro != null ? p.Parceiro.Nome : null,
                    Reportes = db.Reportes.Count(r => r.PontoId == p.Id && r.Status == StatusReporte.Pendente)
                })
                .ToListAsync(ct);

            return Results.Ok(linhas.Select(p => new PontoAdminDto(p.Id, p.Nome, p.Endereco, p.Cidade, p.Uf, p.Cep,
                p.Telefone, p.Horario, p.Localizacao.Y, p.Localizacao.X, p.Materiais, p.Status.ToString(), p.Parceiro,
                p.AtualizadoEm, p.Reportes)));
        });

        admin.MapPatch("/pontos/{id:guid}/status", async (Guid id, MudarStatusDto dto, ClaimsPrincipal u,
            AppDbContext db, CancellationToken ct) =>
        {
            if (!Enum.TryParse<StatusPonto>(dto.Status, out var novo) || novo == StatusPonto.Pendente)
                return Results.ValidationProblem(new Dictionary<string, string[]>
                    { ["status"] = ["Use Aprovado, Rejeitado ou Inativo."] });

            var ponto = await db.Pontos.FirstOrDefaultAsync(p => p.Id == id, ct);
            if (ponto is null) return NaoEncontrado("Ponto não encontrado");

            ponto.Status = novo;
            ponto.AtualizadoEm = DateTime.UtcNow;
            if (novo == StatusPonto.Aprovado)
            {
                ponto.AprovadoPor = u.UsuarioId();
                ponto.AprovadoEm = DateTime.UtcNow;
            }
            await db.SaveChangesAsync(ct);
            return Results.NoContent();
        });

        // ---- RF17: gerenciar categorias e materiais ----
        admin.MapPost("/categorias", async (CategoriaEntradaDto dto, AppDbContext db, CancellationToken ct) =>
        {
            if (ValidarCategoria(dto) is { Count: > 0 } erros) return Results.ValidationProblem(erros);
            if (await db.Categorias.AnyAsync(c => c.Nome == dto.Nome!.Trim(), ct)) return Duplicado("nome", "Já existe uma categoria com este nome.");

            var c = new Categoria { Nome = dto.Nome!.Trim(), Icone = ContasEndpoints.Limpar(dto.Icone), Cor = ContasEndpoints.Limpar(dto.Cor) };
            db.Categorias.Add(c);
            await db.SaveChangesAsync(ct);
            return Results.Created($"/v1/categorias", new { c.Id });
        });

        admin.MapPut("/categorias/{id:int}", async (int id, CategoriaEntradaDto dto, AppDbContext db, CancellationToken ct) =>
        {
            if (ValidarCategoria(dto) is { Count: > 0 } erros) return Results.ValidationProblem(erros);
            var c = await db.Categorias.FindAsync([id], ct);
            if (c is null) return NaoEncontrado("Categoria não encontrada");
            if (await db.Categorias.AnyAsync(x => x.Id != id && x.Nome == dto.Nome!.Trim(), ct)) return Duplicado("nome", "Já existe uma categoria com este nome.");

            c.Nome = dto.Nome!.Trim();
            c.Icone = ContasEndpoints.Limpar(dto.Icone);
            c.Cor = ContasEndpoints.Limpar(dto.Cor);
            await db.SaveChangesAsync(ct);
            return Results.NoContent();
        });

        admin.MapPost("/materiais", async (MaterialEntradaDto dto, AppDbContext db, CancellationToken ct) =>
        {
            if (await ValidarMaterialAsync(dto, null, db, ct) is { Count: > 0 } erros) return Results.ValidationProblem(erros);
            var m = new Material();
            Aplicar(dto, m);
            db.Materiais.Add(m);
            await db.SaveChangesAsync(ct);
            return Results.Created($"/v1/materiais/{m.Id}", new { m.Id });
        });

        admin.MapPut("/materiais/{id:int}", async (int id, MaterialEntradaDto dto, AppDbContext db, CancellationToken ct) =>
        {
            var m = await db.Materiais.FindAsync([id], ct);
            if (m is null) return NaoEncontrado("Material não encontrado");
            if (await ValidarMaterialAsync(dto, id, db, ct) is { Count: > 0 } erros) return Results.ValidationProblem(erros);
            Aplicar(dto, m);
            await db.SaveChangesAsync(ct);
            return Results.NoContent();
        });

        admin.MapDelete("/materiais/{id:int}", async (int id, AppDbContext db, CancellationToken ct) =>
        {
            var m = await db.Materiais.FindAsync([id], ct);
            if (m is null) return NaoEncontrado("Material não encontrado");
            if (await db.PontoMateriais.AnyAsync(pm => pm.MaterialId == id, ct)
                || await db.Identificacoes.AnyAsync(i => i.MaterialSugeridoId == id || i.MaterialConfirmadoId == id, ct))
                return Results.Problem(statusCode: StatusCodes.Status409Conflict, title: "Material em uso",
                    detail: "Há pontos ou identificações ligados a este material. Edite-o em vez de excluir.");
            db.Materiais.Remove(m);
            await db.SaveChangesAsync(ct);
            return Results.NoContent();
        });

        // ---- RF19 (lado do admin): tratar reportes de informação incorreta ----
        admin.MapGet("/reportes", async (string? status, AppDbContext db, CancellationToken ct) =>
        {
            var consulta = db.Reportes.AsNoTracking();
            if (status is not null)
            {
                if (!Enum.TryParse<StatusReporte>(status, out var s))
                    return Results.ValidationProblem(new Dictionary<string, string[]> { ["status"] = ["Status inválido."] });
                consulta = consulta.Where(r => r.Status == s);
            }
            var lista = await consulta
                .OrderByDescending(r => r.CriadoEm)
                .Take(500)
                .Join(db.Pontos, r => r.PontoId, p => p.Id, (r, p) => new { r, p.Nome })
                .Select(x => new ReporteAdminDto(x.r.Id, x.r.PontoId, x.Nome, x.r.Motivo.ToString(), x.r.Comentario,
                    x.r.Status.ToString(), x.r.CriadoEm))
                .ToListAsync(ct);
            return Results.Ok(lista);
        });

        admin.MapPatch("/reportes/{id:guid}", async (Guid id, MudarStatusDto dto, AppDbContext db, CancellationToken ct) =>
        {
            if (!Enum.TryParse<StatusReporte>(dto.Status, out var novo) || novo == StatusReporte.Pendente)
                return Results.ValidationProblem(new Dictionary<string, string[]> { ["status"] = ["Use Resolvido ou Descartado."] });
            var r = await db.Reportes.FindAsync([id], ct);
            if (r is null) return NaoEncontrado("Reporte não encontrado");
            r.Status = novo;
            await db.SaveChangesAsync(ct);
            return Results.NoContent();
        });

        // ---- RF21: estatísticas de uso ----
        admin.MapGet("/estatisticas", async (AppDbContext db, CancellationToken ct) =>
        {
            var total = await db.Identificacoes.CountAsync(ct);
            var confirmadas = await db.Identificacoes.CountAsync(i => i.MaterialConfirmadoId != null, ct);
            var corrigidas = await db.Identificacoes.CountAsync(i => i.Corrigido, ct);
            var porStatus = await db.Pontos.GroupBy(p => p.Status)
                .Select(g => new { g.Key, Qtd = g.Count() }).ToListAsync(ct);
            var maisIdentificados = await db.Identificacoes
                .Where(i => i.MaterialConfirmadoId != null)
                .GroupBy(i => i.MaterialConfirmadoId)
                .Select(g => new { Id = g.Key, Qtd = g.Count() })
                .OrderByDescending(g => g.Qtd).Take(5)
                .Join(db.Materiais, g => g.Id, m => (int?)m.Id, (g, m) => new MaterialContagemDto(m.Nome, g.Qtd))
                .ToListAsync(ct);

            return Results.Ok(new EstatisticasDto(
                total, confirmadas, corrigidas,
                confirmadas == 0 ? null : Math.Round((double)(confirmadas - corrigidas) / confirmadas, 3),
                await db.Buscas.CountAsync(ct),
                Enum.GetValues<StatusPonto>().ToDictionary(s => s.ToString(), s => porStatus.FirstOrDefault(x => x.Key == s)?.Qtd ?? 0),
                await db.Parceiros.CountAsync(ct),
                await db.Reportes.CountAsync(r => r.Status == StatusReporte.Pendente, ct),
                maisIdentificados));
        });

        return app;
    }

    private static Dictionary<string, string[]> ValidarCategoria(CategoriaEntradaDto dto)
    {
        var erros = new Dictionary<string, string[]>();
        if (string.IsNullOrWhiteSpace(dto.Nome) || dto.Nome.Trim().Length > 60) erros["nome"] = ["Informe o nome (até 60 caracteres)."];
        if (ContasEndpoints.Limpar(dto.Icone) is { Length: > 60 }) erros["icone"] = ["Ícone com até 60 caracteres."];
        if (ContasEndpoints.Limpar(dto.Cor) is { } cor && !System.Text.RegularExpressions.Regex.IsMatch(cor, "^#[0-9A-Fa-f]{6}$"))
            erros["cor"] = ["Cor no formato #RRGGBB."];
        return erros;
    }

    private static async Task<Dictionary<string, string[]>> ValidarMaterialAsync(
        MaterialEntradaDto dto, int? id, AppDbContext db, CancellationToken ct)
    {
        var erros = new Dictionary<string, string[]>();
        if (string.IsNullOrWhiteSpace(dto.Nome) || dto.Nome.Trim().Length > 80) erros["nome"] = ["Informe o nome (até 80 caracteres)."];
        else if (await db.Materiais.AnyAsync(m => m.Id != id && m.Nome == dto.Nome.Trim(), ct)) erros["nome"] = ["Já existe um material com este nome."];
        if (string.IsNullOrWhiteSpace(dto.Instrucoes)) erros["instrucoes"] = ["Informe as instruções de descarte."];
        if (dto.CategoriaId is null || !await db.Categorias.AnyAsync(c => c.Id == dto.CategoriaId, ct)) erros["categoriaId"] = ["Escolha uma categoria."];
        if (dto.Sinonimos?.Any(s => s.Trim().Length > 60) == true) erros["sinonimos"] = ["Cada sinônimo com até 60 caracteres."];
        return erros;
    }

    private static void Aplicar(MaterialEntradaDto dto, Material m)
    {
        m.CategoriaId = dto.CategoriaId!.Value;
        m.Nome = dto.Nome!.Trim();
        m.Instrucoes = dto.Instrucoes!.Trim();
        m.Cuidados = ContasEndpoints.Limpar(dto.Cuidados);
        var sinonimos = dto.Sinonimos?.Select(s => s.Trim()).Where(s => s.Length > 0).Distinct().ToArray();
        m.Sinonimos = sinonimos is { Length: > 0 } ? sinonimos : null;
        m.Perigoso = dto.Perigoso;
    }

    private static IResult NaoEncontrado(string titulo) => Results.Problem(statusCode: StatusCodes.Status404NotFound, title: titulo);

    private static IResult Duplicado(string campo, string msg) =>
        Results.ValidationProblem(new Dictionary<string, string[]> { [campo] = [msg] });
}
